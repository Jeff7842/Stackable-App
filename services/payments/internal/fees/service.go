package fees

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/stackable/payments/internal/provider"
)

// Service holds the fee, payment and ledger rules. It knows nothing about HTTP.
type Service struct {
	store     Store
	providers map[string]provider.PaymentProvider
	now       func() time.Time
}

// NewService builds a Service; each provider serves the rail and webhook path named by its Name.
func NewService(store Store, providers ...provider.PaymentProvider) *Service {
	m := map[string]provider.PaymentProvider{}
	for _, p := range providers {
		m[p.Name()] = p
	}
	return &Service{store: store, providers: m, now: func() time.Time { return time.Now().UTC() }}
}

// CreateFeeStructure saves a price list so invoices can be issued from it.
// It returns a conflict when the same term, level and name already exist.
func (s *Service) CreateFeeStructure(ctx context.Context, schoolID string, in FeeStructureInput) (FeeStructure, error) {
	fs := FeeStructure{ID: newID(), Term: in.Term, Level: in.Level, Name: in.Name, CreatedAt: s.now()}
	for _, it := range in.Items {
		fs.Items = append(fs.Items, FeeItem{ID: newID(), Name: it.Name, AmountMinor: it.AmountMinor, Mandatory: it.Mandatory})
	}
	err := s.store.InTx(ctx, schoolID, func(r Repo) error { return r.InsertFeeStructure(ctx, fs) })
	if errors.Is(err, ErrDuplicate) {
		return FeeStructure{}, conflict("FEE_STRUCTURE_EXISTS", "A fee structure with this term, level and name already exists.")
	}
	return fs, err
}

// ListFeeStructures returns one page of structures, ordered by id; after is the last id seen.
func (s *Service) ListFeeStructures(ctx context.Context, schoolID, term, level, after string, limit int) ([]FeeStructure, error) {
	var out []FeeStructure
	err := s.store.InTx(ctx, schoolID, func(r Repo) (err error) {
		out, err = r.ListFeeStructures(ctx, term, level, after, limit)
		return err
	})
	return out, err
}

// IssueInvoices bills each student and debits the ledger for every line, all in one transaction.
// A structure issues its mandatory items; a student already billed for that structure and term is a conflict.
func (s *Service) IssueInvoices(ctx context.Context, schoolID string, in IssueInvoicesInput) ([]Invoice, error) {
	var invoices []Invoice
	err := s.store.InTx(ctx, schoolID, func(r Repo) error {
		term, lines, err := s.linesToIssue(ctx, r, in)
		if err != nil {
			return err
		}
		now := s.now()
		for _, studentID := range in.StudentIDs {
			inv := Invoice{ID: newID(), StudentID: studentID, Term: term, Status: InvoiceIssued, FeeStructureID: in.FeeStructureID, IssuedAt: now}
			for _, l := range lines {
				l.ID, l.InvoiceID = newID(), inv.ID
				inv.Lines = append(inv.Lines, l)
				inv.TotalMinor += l.AmountMinor
			}
			if err := r.InsertInvoice(ctx, inv); err != nil {
				if errors.Is(err, ErrDuplicate) {
					return domainErr(409, "INVOICE_ALREADY_ISSUED", "A student is already invoiced for this fee structure and term.", map[string]string{"studentId": studentID})
				}
				return err
			}
			for _, l := range inv.Lines {
				e := LedgerEntry{ID: newID(), StudentID: studentID, Account: AccountReceivable, Kind: LedgerDebitInvoice,
					AmountMinor: l.AmountMinor, RefType: "invoice_line", RefID: l.ID, CreatedAt: now}
				if err := r.InsertLedgerEntry(ctx, e); err != nil {
					return err
				}
			}
			invoices = append(invoices, inv)
		}
		return nil
	})
	return invoices, err
}

func (s *Service) linesToIssue(ctx context.Context, r Repo, in IssueInvoicesInput) (string, []InvoiceLine, error) {
	if in.FeeStructureID == "" {
		lines := make([]InvoiceLine, 0, len(in.Lines))
		for _, l := range in.Lines {
			lines = append(lines, InvoiceLine{FeeItemID: l.FeeItemID, Description: l.Description, AmountMinor: l.AmountMinor})
		}
		return in.Term, lines, nil
	}
	fs, err := r.GetFeeStructure(ctx, in.FeeStructureID)
	if err != nil {
		return "", nil, err
	}
	if fs == nil {
		return "", nil, notFound("FEE_STRUCTURE_NOT_FOUND", "Fee structure not found.")
	}
	var lines []InvoiceLine
	for _, it := range fs.Items {
		if it.Mandatory {
			lines = append(lines, InvoiceLine{FeeItemID: it.ID, Description: it.Name, AmountMinor: it.AmountMinor})
		}
	}
	if len(lines) == 0 {
		return "", nil, unprocessable("FEE_STRUCTURE_EMPTY", "This fee structure has no mandatory items to invoice.")
	}
	return fs.Term, lines, nil
}

// StatementLine is one invoice line with its payments applied.
type StatementLine struct {
	LineID           string `json:"lineId"`
	InvoiceID        string `json:"invoiceId"`
	Description      string `json:"description"`
	AmountMinor      int64  `json:"amountMinor"`
	PaidMinor        int64  `json:"paidMinor"`
	OutstandingMinor int64  `json:"outstandingMinor"`
}

// TermStatement groups a student's lines by term.
type TermStatement struct {
	Term          string          `json:"term"`
	InvoicedMinor int64           `json:"invoicedMinor"`
	PaidMinor     int64           `json:"paidMinor"`
	BalanceMinor  int64           `json:"balanceMinor"`
	Lines         []StatementLine `json:"lines"`
}

// Statement is what a parent or the finance office sees for one student.
// BalanceMinor is the ledger sum: terms' balances minus unapplied credit.
type Statement struct {
	StudentID    string           `json:"studentId"`
	BalanceMinor int64            `json:"balanceMinor"`
	CreditMinor  int64            `json:"creditMinor"`
	Terms        []TermStatement  `json:"terms"`
	Payments     []PaymentSummary `json:"payments"`
}

// GetStatement builds the statement; term filters the lines but never the ledger balance.
func (s *Service) GetStatement(ctx context.Context, schoolID, studentID, term string) (Statement, error) {
	st := Statement{StudentID: studentID, Terms: []TermStatement{}}
	err := s.store.InTx(ctx, schoolID, func(r Repo) error {
		balance, err := r.LedgerBalance(ctx, AccountReceivable, studentID)
		if err != nil {
			return err
		}
		lines, err := r.StatementLines(ctx, studentID, term, statementLineCap)
		if err != nil {
			return err
		}
		if st.CreditMinor, err = r.CreditAllocatedMinor(ctx, studentID); err != nil {
			return err
		}
		if st.Payments, err = r.ListPaymentsByStudent(ctx, studentID, statementPayCap); err != nil {
			return err
		}
		st.BalanceMinor, st.Terms = balance, groupByTerm(lines)
		return nil
	})
	return st, err
}

func groupByTerm(lines []LineBalance) []TermStatement {
	byTerm := map[string]*TermStatement{}
	for _, l := range lines {
		t := byTerm[l.Term]
		if t == nil {
			t = &TermStatement{Term: l.Term, Lines: []StatementLine{}}
			byTerm[l.Term] = t
		}
		t.InvoicedMinor += l.AmountMinor
		t.PaidMinor += l.PaidMinor
		t.BalanceMinor += l.Outstanding()
		t.Lines = append(t.Lines, StatementLine{LineID: l.ID, InvoiceID: l.InvoiceID, Description: l.Description,
			AmountMinor: l.AmountMinor, PaidMinor: l.PaidMinor, OutstandingMinor: l.Outstanding()})
	}
	out := make([]TermStatement, 0, len(byTerm))
	for _, t := range byTerm {
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Term > out[j].Term })
	return out
}

// Reconciliation returns payment rows created in [from, to) for the Excel export; after pages by payment id.
func (s *Service) Reconciliation(ctx context.Context, schoolID string, from, to time.Time, after string, limit int) ([]ReconRow, error) {
	var rows []ReconRow
	err := s.store.InTx(ctx, schoolID, func(r Repo) (err error) {
		rows, err = r.Reconciliation(ctx, from, to, after, limit)
		return err
	})
	return rows, err
}

// ListUnmatched returns the queue, open rows only unless includeResolved is set.
func (s *Service) ListUnmatched(ctx context.Context, schoolID string, includeResolved bool, after string, limit int) ([]UnmatchedView, error) {
	var rows []UnmatchedView
	err := s.store.InTx(ctx, schoolID, func(r Repo) (err error) {
		rows, err = r.ListUnmatched(ctx, includeResolved, after, limit)
		return err
	})
	return rows, err
}

// GetPayment returns one payment so clients can poll its status.
func (s *Service) GetPayment(ctx context.Context, schoolID, id string) (Payment, error) {
	var p *Payment
	err := s.store.InTx(ctx, schoolID, func(r Repo) (err error) {
		p, err = r.GetPayment(ctx, id)
		return err
	})
	if err == nil && p == nil {
		err = notFound("PAYMENT_NOT_FOUND", "Payment not found.")
	}
	if err != nil {
		return Payment{}, err
	}
	return *p, nil
}
