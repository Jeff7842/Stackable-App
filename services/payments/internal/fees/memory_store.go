package fees

import (
	"context"
	"crypto/rand"
	"fmt"
	"maps"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

// newID returns a random UUID v4 string; ids are made in Go so both stores share them.
func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand does not fail on supported platforms
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

type memState struct {
	feeStructures map[string]FeeStructure
	invoices      map[string]Invoice
	payments      map[string]Payment
	allocations   []Allocation
	ledger        []LedgerEntry
	receipts      map[string]Receipt // keyed by payment id
	receiptSeq    map[string]int64   // keyed by school id
	unmatched     map[string]Unmatched
	outbox        []OutboxEvent
	events        map[string]WebhookEvent
}

func newMemState() *memState {
	return &memState{
		feeStructures: map[string]FeeStructure{}, invoices: map[string]Invoice{}, payments: map[string]Payment{},
		receipts: map[string]Receipt{}, receiptSeq: map[string]int64{}, unmatched: map[string]Unmatched{},
		events: map[string]WebhookEvent{},
	}
}

// clone copies the state; rows are values and their slices are never mutated in place.
func (s *memState) clone() *memState {
	return &memState{
		feeStructures: maps.Clone(s.feeStructures), invoices: maps.Clone(s.invoices), payments: maps.Clone(s.payments),
		allocations: slices.Clone(s.allocations), ledger: slices.Clone(s.ledger), receipts: maps.Clone(s.receipts),
		receiptSeq: maps.Clone(s.receiptSeq), unmatched: maps.Clone(s.unmatched), outbox: slices.Clone(s.outbox),
		events: maps.Clone(s.events),
	}
}

// MemoryStore is an in-process Store for tests and local runs; a transaction works on a copy and commits by swap.
type MemoryStore struct {
	mu    sync.Mutex
	state *memState
}

// NewMemoryStore returns an empty MemoryStore.
func NewMemoryStore() *MemoryStore { return &MemoryStore{state: newMemState()} }

// InTx serialises transactions, so a failing fn leaves the committed state untouched.
func (m *MemoryStore) InTx(_ context.Context, schoolID string, fn func(Repo) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	work := m.state.clone()
	if err := fn(&memRepo{s: work, school: schoolID}); err != nil {
		return err
	}
	m.state = work
	return nil
}

// PaymentSchool scans payments for the provider transaction.
func (m *MemoryStore) PaymentSchool(_ context.Context, rail, txnID string) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range m.state.payments {
		if p.Rail == rail && p.ProviderTransactionID == txnID && txnID != "" {
			return p.SchoolID, true, nil
		}
	}
	return "", false, nil
}

// RecordOrphanEvent stores a school-less webhook once.
func (m *MemoryStore) RecordOrphanEvent(_ context.Context, ev WebhookEvent) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := ev.Provider + "\x00" + ev.ExternalEventID
	if _, ok := m.state.events[key]; ok {
		return false, nil
	}
	m.state.events[key] = ev
	return true, nil
}

// EventCount returns how many webhook events are stored.
func (m *MemoryStore) EventCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.state.events)
}

type memRepo struct {
	s      *memState
	school string
}

func (r *memRepo) InsertFeeStructure(_ context.Context, fs FeeStructure) error {
	for _, e := range r.s.feeStructures {
		if e.SchoolID == r.school && e.Term == fs.Term && e.Level == fs.Level && e.Name == fs.Name {
			return ErrDuplicate
		}
	}
	fs.SchoolID = r.school
	r.s.feeStructures[fs.ID] = fs
	return nil
}

func (r *memRepo) GetFeeStructure(_ context.Context, id string) (*FeeStructure, error) {
	fs, ok := r.s.feeStructures[id]
	if !ok || fs.SchoolID != r.school {
		return nil, nil
	}
	return &fs, nil
}

func (r *memRepo) ListFeeStructures(_ context.Context, term, level, after string, limit int) ([]FeeStructure, error) {
	var out []FeeStructure
	for _, fs := range r.s.feeStructures {
		if fs.SchoolID == r.school && (term == "" || fs.Term == term) && (level == "" || fs.Level == level) && fs.ID > after {
			out = append(out, fs)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out[:min(limit, len(out))], nil
}

func (r *memRepo) InsertInvoice(_ context.Context, inv Invoice) error {
	if inv.FeeStructureID != "" {
		for _, e := range r.s.invoices {
			if e.SchoolID == r.school && e.StudentID == inv.StudentID && e.Term == inv.Term && e.FeeStructureID == inv.FeeStructureID {
				return ErrDuplicate
			}
		}
	}
	inv.SchoolID = r.school
	r.s.invoices[inv.ID] = inv
	return nil
}

func (r *memRepo) paid(lineID string) int64 {
	var sum int64
	for _, a := range r.s.allocations {
		if a.SchoolID == r.school && a.TargetType == TargetInvoiceLine && a.TargetID == lineID {
			sum += a.AmountMinor
		}
	}
	return sum
}

func (r *memRepo) balances(studentID, term string, ids []string) []LineBalance {
	var out []LineBalance
	for _, inv := range r.s.invoices {
		if inv.SchoolID != r.school || inv.StudentID != studentID || (term != "" && inv.Term != term) {
			continue
		}
		for _, l := range inv.Lines {
			if ids != nil && !slices.Contains(ids, l.ID) {
				continue
			}
			out = append(out, LineBalance{InvoiceLine: l, StudentID: inv.StudentID, Term: inv.Term, InvoiceStatus: inv.Status, PaidMinor: r.paid(l.ID)})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (r *memRepo) LinesForUpdate(_ context.Context, studentID string, ids []string) ([]LineBalance, error) {
	return r.balances(studentID, "", append([]string{}, ids...)), nil
}

func (r *memRepo) RefreshInvoiceStatuses(_ context.Context, invoiceIDs []string) error {
	for _, id := range invoiceIDs {
		inv, ok := r.s.invoices[id]
		if !ok || inv.SchoolID != r.school {
			continue
		}
		var paid int64
		for _, l := range inv.Lines {
			paid += r.paid(l.ID)
		}
		inv.Status = invoiceStatus(paid, inv.TotalMinor)
		r.s.invoices[id] = inv
	}
	return nil
}

func invoiceStatus(paid, total int64) string {
	switch {
	case paid >= total:
		return InvoicePaid
	case paid > 0:
		return InvoicePartial
	default:
		return InvoiceIssued
	}
}

func (r *memRepo) StatementLines(_ context.Context, studentID, term string, limit int) ([]LineBalance, error) {
	out := r.balances(studentID, term, nil)
	return out[:min(limit, len(out))], nil
}

func (r *memRepo) InsertPaymentIfNew(_ context.Context, p Payment) (bool, error) {
	for _, e := range r.s.payments {
		if e.SchoolID == r.school && e.IdempotencyKey == p.IdempotencyKey {
			return false, nil
		}
	}
	p.SchoolID = r.school
	r.s.payments[p.ID] = p
	return true, nil
}

func (r *memRepo) GetPayment(_ context.Context, id string) (*Payment, error) {
	p, ok := r.s.payments[id]
	if !ok || p.SchoolID != r.school {
		return nil, nil
	}
	return &p, nil
}

func (r *memRepo) GetPaymentByIdempotencyKey(_ context.Context, key string) (*Payment, error) {
	for _, p := range r.s.payments {
		if p.SchoolID == r.school && p.IdempotencyKey == key {
			return &p, nil
		}
	}
	return nil, nil
}

func (r *memRepo) GetPaymentByProviderTxn(_ context.Context, rail, txnID string) (*Payment, error) {
	for _, p := range r.s.payments {
		if p.SchoolID == r.school && p.Rail == rail && p.ProviderTransactionID == txnID {
			return &p, nil
		}
	}
	return nil, nil
}

func (r *memRepo) UpdatePayment(_ context.Context, p Payment) error {
	old, ok := r.s.payments[p.ID]
	if !ok || old.SchoolID != r.school {
		return fmt.Errorf("payment %s not found", p.ID)
	}
	if p.ProviderTransactionID != "" {
		for _, e := range r.s.payments {
			if e.ID != p.ID && e.Rail == p.Rail && e.ProviderTransactionID == p.ProviderTransactionID {
				return ErrDuplicate
			}
		}
	}
	p.SchoolID = r.school
	r.s.payments[p.ID] = p
	return nil
}

func (r *memRepo) ListPaymentsByStudent(_ context.Context, studentID string, limit int) ([]PaymentSummary, error) {
	var out []PaymentSummary
	for _, p := range r.s.payments {
		if p.SchoolID != r.school || p.StudentID != studentID {
			continue
		}
		out = append(out, PaymentSummary{ID: p.ID, Rail: p.Rail, AmountMinor: p.AmountMinor, Status: p.Status,
			FailureCode: p.FailureCode, ReceiptNumber: r.s.receipts[p.ID].Number, CreatedAt: p.CreatedAt})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out[:min(limit, len(out))], nil
}

func (r *memRepo) InsertAllocations(_ context.Context, allocs []Allocation) error {
	for _, a := range allocs {
		a.SchoolID = r.school
		r.s.allocations = append(r.s.allocations, a)
	}
	return nil
}

func (r *memRepo) CreditAllocatedMinor(_ context.Context, studentID string) (int64, error) {
	var sum int64
	for _, a := range r.s.allocations {
		if a.SchoolID == r.school && a.TargetType == TargetStudentCredit && a.TargetID == studentID {
			sum += a.AmountMinor
		}
	}
	return sum, nil
}

func (r *memRepo) InsertLedgerEntry(_ context.Context, e LedgerEntry) error {
	e.SchoolID = r.school
	r.s.ledger = append(r.s.ledger, e)
	return nil
}

func (r *memRepo) LedgerBalance(_ context.Context, account, studentID string) (int64, error) {
	var sum int64
	for _, e := range r.s.ledger {
		if e.SchoolID == r.school && e.Account == account && e.StudentID == studentID {
			sum += e.AmountMinor
		}
	}
	return sum, nil
}

func (r *memRepo) NextReceiptNumber(_ context.Context) (string, error) {
	r.s.receiptSeq[r.school]++
	return fmt.Sprintf("RCT-%06d", r.s.receiptSeq[r.school]), nil
}

func (r *memRepo) InsertReceipt(_ context.Context, rc Receipt) error {
	rc.SchoolID = r.school
	r.s.receipts[rc.PaymentID] = rc
	return nil
}

func (r *memRepo) InsertUnmatched(_ context.Context, u Unmatched) error {
	u.SchoolID = r.school
	r.s.unmatched[u.PaymentID] = u
	return nil
}

func (r *memRepo) GetUnmatchedForUpdate(_ context.Context, paymentID string) (*Unmatched, error) {
	u, ok := r.s.unmatched[paymentID]
	if !ok || u.SchoolID != r.school {
		return nil, nil
	}
	return &u, nil
}

func (r *memRepo) MarkUnmatchedResolved(_ context.Context, paymentID, resolvedBy string, at time.Time) error {
	u, ok := r.s.unmatched[paymentID]
	if !ok || u.SchoolID != r.school {
		return fmt.Errorf("unmatched %s not found", paymentID)
	}
	u.ResolvedBy, u.ResolvedAt = resolvedBy, &at
	r.s.unmatched[paymentID] = u
	return nil
}

func (r *memRepo) ListUnmatched(_ context.Context, includeResolved bool, after string, limit int) ([]UnmatchedView, error) {
	var out []UnmatchedView
	for _, u := range r.s.unmatched {
		if u.SchoolID != r.school || u.PaymentID <= after || (!includeResolved && u.ResolvedAt != nil) {
			continue
		}
		p := r.s.payments[u.PaymentID]
		out = append(out, UnmatchedView{PaymentID: u.PaymentID, Reason: u.Reason, Rail: p.Rail, AmountMinor: p.AmountMinor,
			StudentID: p.StudentID, ProviderTransactionID: p.ProviderTransactionID, CreatedAt: u.CreatedAt,
			ResolvedBy: u.ResolvedBy, ResolvedAt: u.ResolvedAt})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PaymentID < out[j].PaymentID })
	return out[:min(limit, len(out))], nil
}

func (r *memRepo) InsertOutbox(_ context.Context, e OutboxEvent) error {
	e.SchoolID = r.school
	r.s.outbox = append(r.s.outbox, e)
	return nil
}

func (r *memRepo) InsertWebhookEvent(_ context.Context, ev WebhookEvent) (bool, error) {
	key := ev.Provider + "\x00" + ev.ExternalEventID
	if _, ok := r.s.events[key]; ok {
		return false, nil
	}
	r.s.events[key] = ev
	return true, nil
}

func (r *memRepo) Reconciliation(_ context.Context, from, to time.Time, after string, limit int) ([]ReconRow, error) {
	var out []ReconRow
	for _, p := range r.s.payments {
		if p.SchoolID != r.school || p.ID <= after || p.CreatedAt.Before(from) || !p.CreatedAt.Before(to) {
			continue
		}
		row := ReconRow{PaymentID: p.ID, ReceiptNumber: r.s.receipts[p.ID].Number, StudentID: p.StudentID, Rail: p.Rail,
			ProviderTransactionID: p.ProviderTransactionID, Status: p.Status, AmountMinor: p.AmountMinor, CreatedAt: p.CreatedAt}
		for _, a := range r.s.allocations {
			if a.PaymentID != p.ID {
				continue
			}
			if a.TargetType == TargetInvoiceLine {
				row.AllocatedMinor += a.AmountMinor
			} else {
				row.CreditMinor += a.AmountMinor
			}
		}
		out = append(out, row)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].PaymentID < out[j].PaymentID })
	return out[:min(limit, len(out))], nil
}

// isUUID reports whether s looks like a canonical UUID; used at the gate and for path params.
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range strings.ToLower(s) {
		switch {
		case i == 8 || i == 13 || i == 18 || i == 23:
			if c != '-' {
				return false
			}
		case !(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f'):
			return false
		}
	}
	return true
}
