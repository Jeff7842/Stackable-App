package fees

import (
	"context"
	"time"
)

// Repo is the data access inside one transaction; every call is scoped to one school.
type Repo interface {
	InsertFeeStructure(ctx context.Context, fs FeeStructure) error
	GetFeeStructure(ctx context.Context, id string) (*FeeStructure, error)
	ListFeeStructures(ctx context.Context, term, level, after string, limit int) ([]FeeStructure, error)

	InsertInvoice(ctx context.Context, inv Invoice) error
	// LinesForUpdate locks and returns the student's lines among ids; foreign or unknown ids are skipped.
	LinesForUpdate(ctx context.Context, studentID string, ids []string) ([]LineBalance, error)
	RefreshInvoiceStatuses(ctx context.Context, invoiceIDs []string) error
	StatementLines(ctx context.Context, studentID, term string, limit int) ([]LineBalance, error)

	// InsertPaymentIfNew returns false when the idempotency key already exists.
	InsertPaymentIfNew(ctx context.Context, p Payment) (bool, error)
	GetPayment(ctx context.Context, id string) (*Payment, error)
	GetPaymentByIdempotencyKey(ctx context.Context, key string) (*Payment, error)
	GetPaymentByProviderTxn(ctx context.Context, rail, txnID string) (*Payment, error)
	UpdatePayment(ctx context.Context, p Payment) error
	ListPaymentsByStudent(ctx context.Context, studentID string, limit int) ([]PaymentSummary, error)

	InsertAllocations(ctx context.Context, allocs []Allocation) error
	CreditAllocatedMinor(ctx context.Context, studentID string) (int64, error)

	InsertLedgerEntry(ctx context.Context, e LedgerEntry) error
	// LedgerBalance is the signed sum for an account; an empty studentID means school-level entries.
	LedgerBalance(ctx context.Context, account, studentID string) (int64, error)

	NextReceiptNumber(ctx context.Context) (string, error)
	InsertReceipt(ctx context.Context, r Receipt) error

	InsertUnmatched(ctx context.Context, u Unmatched) error
	GetUnmatchedForUpdate(ctx context.Context, paymentID string) (*Unmatched, error)
	MarkUnmatchedResolved(ctx context.Context, paymentID, resolvedBy string, at time.Time) error
	ListUnmatched(ctx context.Context, includeResolved bool, after string, limit int) ([]UnmatchedView, error)

	InsertOutbox(ctx context.Context, e OutboxEvent) error
	// InsertWebhookEvent returns false when the (provider, event id) pair was already stored.
	InsertWebhookEvent(ctx context.Context, ev WebhookEvent) (bool, error)

	Reconciliation(ctx context.Context, from, to time.Time, after string, limit int) ([]ReconRow, error)
}

// Store runs work in all-or-nothing transactions.
type Store interface {
	// InTx runs fn atomically for one school; an error from fn rolls everything back.
	InTx(ctx context.Context, schoolID string, fn func(Repo) error) error
	// PaymentSchool finds the school that owns a provider transaction; webhooks arrive without a token.
	PaymentSchool(ctx context.Context, rail, txnID string) (schoolID string, found bool, err error)
	// RecordOrphanEvent stores a webhook whose school cannot be determined.
	RecordOrphanEvent(ctx context.Context, ev WebhookEvent) (bool, error)
}
