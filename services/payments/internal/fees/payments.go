package fees

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"time"

	kit "github.com/stackable/kyfaru-kit"
	"github.com/stackable/payments/internal/provider"
)

// intentError maps provider failures to distinct HTTP errors the UI can show.
func intentError(paymentID string, err error) error {
	details := map[string]string{"paymentId": paymentID}
	var pe *provider.Error
	switch {
	case errors.As(err, &pe):
		status, msg := 402, "The payment was declined."
		switch pe.Code {
		case provider.InsufficientFunds:
			msg = "Insufficient funds on the payer account."
		case provider.WrongPin:
			msg = "The PIN entered was wrong."
		case provider.UserCancelled:
			msg = "The payment was cancelled by the payer."
		case provider.Timeout:
			status, msg = http.StatusGatewayTimeout, "The payment provider did not answer in time. Please try again."
		case provider.RailDown:
			status, msg = http.StatusServiceUnavailable, "This payment method is unavailable right now. Please try later."
		}
		return domainErr(status, "PAYMENT_"+string(pe.Code), msg, details)
	case errors.Is(err, provider.ErrInvalidRequest):
		return domainErr(http.StatusBadRequest, "PAYMENT_REQUEST_INVALID", "The payment details are not valid for this method.", details)
	default:
		return kit.Upstream("The payment provider failed. Please try again.")
	}
}

// CreateIntent records a PENDING payment and asks the rail to collect it.
// The same idempotency key returns the same payment and never charges twice; created is false for a replay.
func (s *Service) CreateIntent(ctx context.Context, schoolID, payerUserID string, in IntentInput) (pay Payment, created bool, err error) {
	prov, ok := s.providers[in.Rail]
	if !ok && (in.Rail == RailCard || in.Rail == RailBank) {
		return Payment{}, false, unprocessable("PAYMENT_RAIL_UNSUPPORTED", "This payment method is not supported yet.")
	}
	now := s.now()
	candidate := Payment{ID: newID(), StudentID: in.StudentID, PayerUserID: payerUserID, Rail: in.Rail, AmountMinor: in.AmountMinor,
		Status: StatusPending, IdempotencyKey: in.IdempotencyKey, Kind: KindInvoiceLine, InvoiceLineIDs: in.InvoiceLineIDs,
		PayerPhone: in.PayerPhone, CreatedAt: now, UpdatedAt: now}
	err = s.store.InTx(ctx, schoolID, func(r Repo) error {
		if existing, err := r.GetPaymentByIdempotencyKey(ctx, in.IdempotencyKey); err != nil || existing != nil {
			return s.replay(existing, in, &pay, err)
		}
		if err := checkOutstanding(ctx, r, in); err != nil {
			return err
		}
		inserted, err := r.InsertPaymentIfNew(ctx, candidate)
		if err != nil {
			return err
		}
		if !inserted { // a concurrent request with the same key won the race
			existing, err := r.GetPaymentByIdempotencyKey(ctx, in.IdempotencyKey)
			return s.replay(existing, in, &pay, err)
		}
		pay, created = candidate, true
		return nil
	})
	if err != nil || !created {
		return pay, false, err
	}
	if prov == nil { // mpesa or fake is configured off
		return s.failIntent(ctx, schoolID, pay, &provider.Error{Code: provider.RailDown, Message: "rail disabled"})
	}
	ref, err := prov.Initiate(ctx, provider.Payment{ID: pay.ID, AmountMinor: pay.AmountMinor, PayerPhone: in.PayerPhone, Reference: pay.ID})
	if err != nil {
		return s.failIntent(ctx, schoolID, pay, err)
	}
	pay.ProviderTransactionID = ref.TransactionID
	err = s.store.InTx(ctx, schoolID, func(r Repo) error {
		pay.UpdatedAt = s.now()
		return r.UpdatePayment(ctx, pay)
	})
	return pay, true, err
}

func (s *Service) replay(existing *Payment, in IntentInput, out *Payment, err error) error {
	if err != nil {
		return err
	}
	if existing.StudentID != in.StudentID || existing.AmountMinor != in.AmountMinor || existing.Rail != in.Rail || !slices.Equal(existing.InvoiceLineIDs, in.InvoiceLineIDs) {
		return conflict("IDEMPOTENCY_KEY_REUSED", "This idempotency key was already used for a different payment.")
	}
	*out = *existing
	return nil
}

func checkOutstanding(ctx context.Context, r Repo, in IntentInput) error {
	lines, err := r.LinesForUpdate(ctx, in.StudentID, in.InvoiceLineIDs)
	if err != nil {
		return err
	}
	if len(lines) != len(in.InvoiceLineIDs) {
		return notFound("INVOICE_LINE_NOT_FOUND", "One or more invoice lines were not found for this student.")
	}
	var outstanding int64
	for _, l := range lines {
		outstanding += l.Outstanding()
	}
	if in.AmountMinor > outstanding {
		return unprocessable("PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING", "The amount is more than is owed on the chosen lines.")
	}
	return nil
}

func (s *Service) failIntent(ctx context.Context, schoolID string, pay Payment, cause error) (Payment, bool, error) {
	pay.Status, pay.UpdatedAt = StatusFailed, s.now()
	var pe *provider.Error
	if errors.As(cause, &pe) {
		pay.FailureCode = string(pe.Code)
	}
	if err := s.store.InTx(ctx, schoolID, func(r Repo) error { return r.UpdatePayment(ctx, pay) }); err != nil {
		return pay, true, fmt.Errorf("mark payment failed: %w", err)
	}
	return pay, true, intentError(pay.ID, cause)
}

// WebhookResult tells the provider what happened; repeats report Duplicate and change nothing.
type WebhookResult struct {
	Duplicate bool   `json:"duplicate"`
	Outcome   string `json:"outcome"`
}

// Webhook outcomes.
const (
	OutcomeConfirmed = "CONFIRMED"
	OutcomeFailed    = "FAILED"
	OutcomeUnmatched = "UNMATCHED"
	OutcomeIgnored   = "IGNORED"
	OutcomeRecorded  = "RECORDED"
)

// ReceiveWebhook verifies a callback, then applies it exactly once in one transaction.
// Event, allocations, ledger credit, receipt and outbox row commit together or not at all.
func (s *Service) ReceiveWebhook(ctx context.Context, providerName string, headers http.Header, body []byte) (WebhookResult, error) {
	prov, ok := s.providers[providerName]
	if !ok {
		return WebhookResult{}, notFound("RESOURCE_NOT_FOUND", "Unknown payment provider.")
	}
	ev, err := prov.VerifyWebhook(headers, body)
	switch {
	case errors.Is(err, provider.ErrBadSignature):
		return WebhookResult{}, kit.Unauthorized("Webhook signature is not valid.")
	case err != nil:
		return WebhookResult{}, domainErr(http.StatusBadRequest, "WEBHOOK_INVALID", "Webhook body is not valid.", nil)
	}
	we := WebhookEvent{Provider: providerName, ExternalEventID: ev.EventID, Payload: json.RawMessage(body)}
	schoolID, found, err := s.store.PaymentSchool(ctx, providerName, ev.TransactionID)
	if err != nil {
		return WebhookResult{}, err
	}
	if !found {
		schoolID = ev.SchoolHint
	}
	if schoolID == "" || !isUUID(schoolID) {
		inserted, err := s.store.RecordOrphanEvent(ctx, we)
		return WebhookResult{Duplicate: !inserted, Outcome: OutcomeRecorded}, err
	}
	res := WebhookResult{Outcome: OutcomeIgnored}
	err = s.store.InTx(ctx, schoolID, func(r Repo) error {
		res = WebhookResult{Outcome: OutcomeIgnored}
		inserted, err := r.InsertWebhookEvent(ctx, we)
		if err != nil || !inserted {
			res.Duplicate = err == nil
			return err
		}
		pay, err := r.GetPaymentByProviderTxn(ctx, providerName, ev.TransactionID)
		if err != nil {
			return err
		}
		res.Outcome, err = s.applyEvent(ctx, r, providerName, pay, ev)
		return err
	})
	return res, err
}

func (s *Service) applyEvent(ctx context.Context, r Repo, rail string, pay *Payment, ev provider.Event) (string, error) {
	now := s.now()
	if pay == nil {
		if !ev.Succeeded || ev.AmountMinor <= 0 {
			return OutcomeIgnored, nil // nothing was received, so there is nothing to queue
		}
		pay = &Payment{ID: newID(), StudentID: ev.StudentHint, Rail: rail, ProviderTransactionID: ev.TransactionID, AmountMinor: ev.AmountMinor,
			Status: StatusPending, IdempotencyKey: "webhook:" + rail + ":" + ev.EventID, Kind: KindInvoiceLine, CreatedAt: now, UpdatedAt: now}
		if _, err := r.InsertPaymentIfNew(ctx, *pay); err != nil {
			return "", err
		}
		return OutcomeUnmatched, s.park(ctx, r, pay, ReasonNoMatchingPayment, now)
	}
	if pay.Status != StatusPending {
		return OutcomeIgnored, nil // a late or repeated event for a finished payment changes nothing
	}
	if !ev.Succeeded {
		pay.Status, pay.FailureCode, pay.UpdatedAt = StatusFailed, string(ev.FailureCode), now
		return OutcomeFailed, r.UpdatePayment(ctx, *pay)
	}
	if ev.AmountMinor != 0 && ev.AmountMinor != pay.AmountMinor {
		pay.AmountMinor = ev.AmountMinor // the rail reports what really moved
		return OutcomeUnmatched, s.park(ctx, r, pay, ReasonAmountMismatch, now)
	}
	return OutcomeConfirmed, s.confirm(ctx, r, pay, pay.StudentID, pay.InvoiceLineIDs, now)
}

// park books received money to the suspense account and queues it for a human.
func (s *Service) park(ctx context.Context, r Repo, pay *Payment, reason string, now time.Time) error {
	pay.Status, pay.UpdatedAt = StatusUnmatched, now
	if err := r.UpdatePayment(ctx, *pay); err != nil {
		return err
	}
	e := LedgerEntry{ID: newID(), Account: AccountSuspense, Kind: LedgerCreditPayment, AmountMinor: -pay.AmountMinor,
		RefType: "payment", RefID: pay.ID, CreatedAt: now}
	if err := r.InsertLedgerEntry(ctx, e); err != nil {
		return err
	}
	return r.InsertUnmatched(ctx, Unmatched{ID: newID(), PaymentID: pay.ID, Reason: reason, CreatedAt: now})
}

// confirm allocates a payment to lines, credits the ledger, issues the receipt and queues payment.confirmed.
// Lines already paid by another payment are skipped, and any remainder becomes student credit.
func (s *Service) confirm(ctx context.Context, r Repo, pay *Payment, studentID string, lineIDs []string, now time.Time) error {
	lines, err := r.LinesForUpdate(ctx, studentID, lineIDs)
	if err != nil {
		return err
	}
	byID := map[string]LineBalance{}
	for _, l := range lines {
		byID[l.ID] = l
	}
	remaining := pay.AmountMinor
	var allocs []Allocation
	var invoiceIDs []string
	for _, id := range lineIDs {
		l, ok := byID[id]
		take := min(remaining, l.Outstanding())
		if !ok || take <= 0 {
			continue
		}
		allocs = append(allocs, Allocation{ID: newID(), PaymentID: pay.ID, TargetType: TargetInvoiceLine, TargetID: id, AmountMinor: take, CreatedAt: now})
		invoiceIDs = append(invoiceIDs, l.InvoiceID)
		remaining -= take
	}
	if remaining > 0 {
		allocs = append(allocs, Allocation{ID: newID(), PaymentID: pay.ID, TargetType: TargetStudentCredit, TargetID: studentID, AmountMinor: remaining, CreatedAt: now})
	}
	if err := r.InsertAllocations(ctx, allocs); err != nil {
		return err
	}
	credit := LedgerEntry{ID: newID(), StudentID: studentID, Account: AccountReceivable, Kind: LedgerCreditPayment,
		AmountMinor: -pay.AmountMinor, RefType: "payment", RefID: pay.ID, CreatedAt: now}
	if err := r.InsertLedgerEntry(ctx, credit); err != nil {
		return err
	}
	if err := r.RefreshInvoiceStatuses(ctx, invoiceIDs); err != nil {
		return err
	}
	pay.StudentID, pay.Status, pay.UpdatedAt = studentID, StatusConfirmed, now
	if err := r.UpdatePayment(ctx, *pay); err != nil {
		return err
	}
	number, err := r.NextReceiptNumber(ctx)
	if err != nil {
		return err
	}
	if err := r.InsertReceipt(ctx, Receipt{ID: newID(), PaymentID: pay.ID, Number: number, IssuedAt: now}); err != nil {
		return err
	}
	payload, err := json.Marshal(map[string]any{"paymentId": pay.ID, "studentId": studentID, "amountMinor": pay.AmountMinor,
		"receiptNumber": number, "creditMinor": remaining})
	if err != nil {
		return fmt.Errorf("encode outbox payload: %w", err)
	}
	return r.InsertOutbox(ctx, OutboxEvent{ID: newID(), Type: "payment.confirmed", AggregateID: pay.ID, Payload: payload, CreatedAt: now})
}

// ResolveUnmatched assigns queued money to a student and confirms the payment.
// It clears the suspense account, then applies the money like a normal confirmation; a second call conflicts.
func (s *Service) ResolveUnmatched(ctx context.Context, schoolID, actor, paymentID string, in ResolveInput) (Payment, error) {
	var out Payment
	err := s.store.InTx(ctx, schoolID, func(r Repo) error {
		u, err := r.GetUnmatchedForUpdate(ctx, paymentID)
		if err != nil {
			return err
		}
		if u == nil {
			return notFound("UNMATCHED_NOT_FOUND", "Unmatched payment not found.")
		}
		pay, err := r.GetPayment(ctx, paymentID)
		if err != nil {
			return err
		}
		if u.ResolvedAt != nil || pay == nil || pay.Status != StatusUnmatched {
			return conflict("PAYMENT_ALREADY_RESOLVED", "This payment has already been resolved.")
		}
		now := s.now()
		clearing := LedgerEntry{ID: newID(), Account: AccountSuspense, Kind: LedgerAdjustment, AmountMinor: pay.AmountMinor,
			RefType: "payment", RefID: pay.ID, CreatedAt: now}
		if err := r.InsertLedgerEntry(ctx, clearing); err != nil {
			return err
		}
		if err := s.confirm(ctx, r, pay, in.StudentID, in.InvoiceLineIDs, now); err != nil {
			return err
		}
		out = *pay
		return r.MarkUnmatchedResolved(ctx, paymentID, actor, now)
	})
	return out, err
}
