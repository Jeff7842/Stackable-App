// Package fees holds the Fees MVP: structures, invoices, payments, the ledger, receipts and reconciliation.
package fees

import (
	"encoding/json"
	"errors"
	"time"
)

// Payment states (SDD P2-14).
const (
	StatusPending   = "PENDING"
	StatusConfirmed = "CONFIRMED"
	StatusReversed  = "REVERSED"
	StatusFailed    = "FAILED"
	StatusUnmatched = "UNMATCHED"
)

// Payment kinds; only INVOICE_LINE is implemented, the rest keep room in the schema.
const (
	KindInvoiceLine = "INVOICE_LINE"
	KindEvent       = "EVENT"
	KindWallet      = "WALLET"
	KindFundraiser  = "FUNDRAISER"
)

// Invoice states.
const (
	InvoiceIssued  = "ISSUED"
	InvoicePartial = "PARTIAL"
	InvoicePaid    = "PAID"
)

// Ledger entry kinds. A balance is the signed sum: debits are positive, credits negative.
const (
	LedgerDebitInvoice  = "DEBIT_INVOICE"
	LedgerCreditPayment = "CREDIT_PAYMENT"
	LedgerRefund        = "REFUND"
	LedgerAdjustment    = "ADJUSTMENT"
)

// Ledger accounts.
const (
	AccountReceivable = "STUDENT_RECEIVABLE"
	AccountSuspense   = "UNMATCHED_SUSPENSE"
)

// Allocation targets.
const (
	TargetInvoiceLine   = "INVOICE_LINE"
	TargetStudentCredit = "STUDENT_CREDIT"
)

// Reasons a payment lands in the unmatched queue.
const (
	ReasonNoMatchingPayment = "NO_MATCHING_PAYMENT"
	ReasonAmountMismatch    = "AMOUNT_MISMATCH"
)

// Rails a payment can use.
const (
	RailMpesa = "mpesa"
	RailCard  = "card"
	RailBank  = "bank"
	RailFake  = "fake"
)

// ErrDuplicate is returned by a Repo when a unique constraint rejects an insert.
var ErrDuplicate = errors.New("duplicate row")

// FeeItem is one chargeable line of a fee structure.
type FeeItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AmountMinor int64  `json:"amountMinor"`
	Mandatory   bool   `json:"mandatory"`
}

// FeeStructure is the price list for one term and level.
type FeeStructure struct {
	ID        string    `json:"id"`
	SchoolID  string    `json:"-"`
	Term      string    `json:"term"`
	Level     string    `json:"level"`
	Name      string    `json:"name"`
	Items     []FeeItem `json:"items"`
	CreatedAt time.Time `json:"createdAt"`
}

// InvoiceLine is one amount a student owes.
type InvoiceLine struct {
	ID          string `json:"id"`
	InvoiceID   string `json:"invoiceId"`
	FeeItemID   string `json:"feeItemId,omitempty"`
	Description string `json:"description"`
	AmountMinor int64  `json:"amountMinor"`
}

// Invoice is the bill issued to one student for one term.
type Invoice struct {
	ID             string        `json:"id"`
	SchoolID       string        `json:"-"`
	StudentID      string        `json:"studentId"`
	Term           string        `json:"term"`
	Status         string        `json:"status"`
	FeeStructureID string        `json:"feeStructureId,omitempty"`
	IssuedAt       time.Time     `json:"issuedAt"`
	TotalMinor     int64         `json:"totalMinor"`
	Lines          []InvoiceLine `json:"lines"`
}

// Payment is one attempt or receipt of money.
type Payment struct {
	ID                    string    `json:"id"`
	SchoolID              string    `json:"-"`
	StudentID             string    `json:"studentId,omitempty"`
	PayerUserID           string    `json:"payerUserId,omitempty"`
	Rail                  string    `json:"rail"`
	ProviderTransactionID string    `json:"providerTransactionId,omitempty"`
	AmountMinor           int64     `json:"amountMinor"`
	Status                string    `json:"status"`
	FailureCode           string    `json:"failureCode,omitempty"`
	IdempotencyKey        string    `json:"-"`
	Kind                  string    `json:"kind"`
	InvoiceLineIDs        []string  `json:"invoiceLineIds"`
	PayerPhone            string    `json:"-"`
	CreatedAt             time.Time `json:"createdAt"`
	UpdatedAt             time.Time `json:"updatedAt"`
}

// Allocation says how much of a payment went to one target.
type Allocation struct {
	ID          string
	SchoolID    string
	PaymentID   string
	TargetType  string
	TargetID    string
	AmountMinor int64
	CreatedAt   time.Time
}

// LedgerEntry is one immutable line of the ledger.
type LedgerEntry struct {
	ID          string
	SchoolID    string
	StudentID   string // empty for school-level accounts such as the suspense account
	Account     string
	Kind        string
	AmountMinor int64
	RefType     string
	RefID       string
	CreatedAt   time.Time
}

// Receipt is the proof of one confirmed payment.
type Receipt struct {
	ID         string    `json:"id"`
	SchoolID   string    `json:"-"`
	PaymentID  string    `json:"paymentId"`
	Number     string    `json:"number"`
	IssuedAt   time.Time `json:"issuedAt"`
	DocumentID string    `json:"documentId,omitempty"`
}

// Unmatched is a queue row for money that needs a human decision.
type Unmatched struct {
	ID         string
	SchoolID   string
	PaymentID  string
	Reason     string
	ResolvedBy string
	ResolvedAt *time.Time
	CreatedAt  time.Time
}

// UnmatchedView is an Unmatched joined with its payment for the finance screen.
type UnmatchedView struct {
	PaymentID             string     `json:"paymentId"`
	Reason                string     `json:"reason"`
	Rail                  string     `json:"rail"`
	AmountMinor           int64      `json:"amountMinor"`
	StudentID             string     `json:"studentId,omitempty"`
	ProviderTransactionID string     `json:"providerTransactionId,omitempty"`
	CreatedAt             time.Time  `json:"createdAt"`
	ResolvedBy            string     `json:"resolvedBy,omitempty"`
	ResolvedAt            *time.Time `json:"resolvedAt,omitempty"`
}

// OutboxEvent is a fact to be relayed to other services.
type OutboxEvent struct {
	ID          string
	SchoolID    string
	Type        string
	AggregateID string
	Payload     json.RawMessage
	CreatedAt   time.Time
}

// WebhookEvent is a provider callback stored once per (provider, event id).
type WebhookEvent struct {
	Provider        string
	ExternalEventID string
	Payload         json.RawMessage
}

// LineBalance is an invoice line with what has been paid against it.
type LineBalance struct {
	InvoiceLine
	StudentID     string
	Term          string
	InvoiceStatus string
	PaidMinor     int64
}

// Outstanding is what is still owed on the line.
func (l LineBalance) Outstanding() int64 { return l.AmountMinor - l.PaidMinor }

// PaymentSummary is a payment as shown on a statement.
type PaymentSummary struct {
	ID            string    `json:"id"`
	Rail          string    `json:"rail"`
	AmountMinor   int64     `json:"amountMinor"`
	Status        string    `json:"status"`
	FailureCode   string    `json:"failureCode,omitempty"`
	ReceiptNumber string    `json:"receiptNumber,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

// ReconRow is one payment line for the finance Excel export.
type ReconRow struct {
	PaymentID             string    `json:"paymentId"`
	ReceiptNumber         string    `json:"receiptNumber,omitempty"`
	StudentID             string    `json:"studentId,omitempty"`
	Rail                  string    `json:"rail"`
	ProviderTransactionID string    `json:"providerTransactionId,omitempty"`
	Status                string    `json:"status"`
	AmountMinor           int64     `json:"amountMinor"`
	AllocatedMinor        int64     `json:"allocatedMinor"`
	CreditMinor           int64     `json:"creditMinor"`
	CreatedAt             time.Time `json:"createdAt"`
}
