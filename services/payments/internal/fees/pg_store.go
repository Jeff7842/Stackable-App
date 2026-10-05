package fees

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	kit "github.com/stackable/go-kit"
)

const uniqueViolation = "23505"

// PgStore is the Postgres Store. It is written to match the migrations but has not been run against a real database.
type PgStore struct {
	pool *pgxpool.Pool
}

// NewPgStore wraps a pool.
func NewPgStore(pool *pgxpool.Pool) *PgStore { return &PgStore{pool: pool} }

// InTx sets app.school_id for RLS and commits only if fn succeeds.
func (s *PgStore) InTx(ctx context.Context, schoolID string, fn func(Repo) error) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		return fn(&pgRepo{tx: tx, school: schoolID})
	})
}

// PaymentSchool uses the security-definer function because RLS hides other schools' rows.
func (s *PgStore) PaymentSchool(ctx context.Context, rail, txnID string) (string, bool, error) {
	var school *string
	if err := s.pool.QueryRow(ctx, `select payments.payment_school($1, $2)::text`, rail, txnID).Scan(&school); err != nil {
		return "", false, fmt.Errorf("find payment school: %w", err)
	}
	if school == nil {
		return "", false, nil
	}
	return *school, true, nil
}

// RecordOrphanEvent stores a school-less webhook once.
func (s *PgStore) RecordOrphanEvent(ctx context.Context, ev WebhookEvent) (bool, error) {
	return insertWebhookEvent(ctx, s.pool, ev)
}

type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func insertWebhookEvent(ctx context.Context, db execer, ev WebhookEvent) (bool, error) {
	tag, err := db.Exec(ctx, `insert into payments.webhook_events (provider, external_event_id, payload) values ($1, $2, $3)
		on conflict (provider, external_event_id) do nothing`, ev.Provider, ev.ExternalEventID, []byte(ev.Payload))
	if err != nil {
		return false, fmt.Errorf("insert webhook event: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

type pgRepo struct {
	tx     pgx.Tx
	school string
}

// nullIf stores an empty string as NULL.
func nullIf(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func mapErr(op string, err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return ErrDuplicate
	}
	return fmt.Errorf("%s: %w", op, err)
}

func (r *pgRepo) InsertFeeStructure(ctx context.Context, fs FeeStructure) error {
	_, err := r.tx.Exec(ctx, `insert into payments.fee_structures (id, school_id, term, level, name, created_at) values ($1,$2,$3,$4,$5,$6)`,
		fs.ID, r.school, fs.Term, fs.Level, fs.Name, fs.CreatedAt)
	if err != nil {
		return mapErr("insert fee structure", err)
	}
	for _, it := range fs.Items {
		if _, err := r.tx.Exec(ctx, `insert into payments.fee_items (id, school_id, fee_structure_id, name, amount_minor, mandatory) values ($1,$2,$3,$4,$5,$6)`,
			it.ID, r.school, fs.ID, it.Name, it.AmountMinor, it.Mandatory); err != nil {
			return mapErr("insert fee item", err)
		}
	}
	return nil
}

func (r *pgRepo) loadItems(ctx context.Context, ids []string) (map[string][]FeeItem, error) {
	rows, err := r.tx.Query(ctx, `select fee_structure_id::text, id::text, name, amount_minor, mandatory from payments.fee_items
		where fee_structure_id = any($1::text[]::uuid[]) order by id`, ids)
	if err != nil {
		return nil, fmt.Errorf("load fee items: %w", err)
	}
	defer rows.Close()
	out := map[string][]FeeItem{}
	for rows.Next() {
		var sid string
		var it FeeItem
		if err := rows.Scan(&sid, &it.ID, &it.Name, &it.AmountMinor, &it.Mandatory); err != nil {
			return nil, fmt.Errorf("scan fee item: %w", err)
		}
		out[sid] = append(out[sid], it)
	}
	return out, rows.Err()
}

func (r *pgRepo) queryStructures(ctx context.Context, sql string, args ...any) ([]FeeStructure, error) {
	rows, err := r.tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("query fee structures: %w", err)
	}
	var out []FeeStructure
	var ids []string
	for rows.Next() {
		fs := FeeStructure{SchoolID: r.school}
		if err := rows.Scan(&fs.ID, &fs.Term, &fs.Level, &fs.Name, &fs.CreatedAt); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan fee structure: %w", err)
		}
		out = append(out, fs)
		ids = append(ids, fs.ID)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(out) == 0 {
		return out, err
	}
	items, err := r.loadItems(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Items = items[out[i].ID]
	}
	return out, nil
}

func (r *pgRepo) GetFeeStructure(ctx context.Context, id string) (*FeeStructure, error) {
	list, err := r.queryStructures(ctx, `select id::text, term, level, name, created_at from payments.fee_structures where school_id = $1 and id = $2`, r.school, id)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

func (r *pgRepo) ListFeeStructures(ctx context.Context, term, level, after string, limit int) ([]FeeStructure, error) {
	return r.queryStructures(ctx, `select id::text, term, level, name, created_at from payments.fee_structures
		where school_id = $1 and ($2 = '' or term = $2) and ($3 = '' or level = $3) and id > coalesce(nullif($4::text, '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		order by id limit $5`, r.school, term, level, after, limit)
}

func (r *pgRepo) InsertInvoice(ctx context.Context, inv Invoice) error {
	_, err := r.tx.Exec(ctx, `insert into payments.invoices (id, school_id, student_id, fee_structure_id, term, status, issued_at, total_minor)
		values ($1,$2,$3,$4,$5,$6,$7,$8)`, inv.ID, r.school, inv.StudentID, nullIf(inv.FeeStructureID), inv.Term, inv.Status, inv.IssuedAt, inv.TotalMinor)
	if err != nil {
		return mapErr("insert invoice", err)
	}
	for _, l := range inv.Lines {
		if _, err := r.tx.Exec(ctx, `insert into payments.invoice_lines (id, school_id, invoice_id, fee_item_id, description, amount_minor)
			values ($1,$2,$3,$4,$5,$6)`, l.ID, r.school, inv.ID, nullIf(l.FeeItemID), l.Description, l.AmountMinor); err != nil {
			return mapErr("insert invoice line", err)
		}
	}
	return nil
}

const lineBalanceSQL = `select l.id::text, l.invoice_id::text, coalesce(l.fee_item_id::text, ''), l.description, l.amount_minor,
	i.student_id::text, i.term, i.status,
	coalesce((select sum(a.amount_minor) from payments.payment_allocations a
		where a.target_type = 'INVOICE_LINE' and a.target_id = l.id), 0)::bigint
	from payments.invoice_lines l join payments.invoices i on i.id = l.invoice_id`

func (r *pgRepo) scanBalances(ctx context.Context, sql string, args ...any) ([]LineBalance, error) {
	rows, err := r.tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("query line balances: %w", err)
	}
	defer rows.Close()
	var out []LineBalance
	for rows.Next() {
		var l LineBalance
		if err := rows.Scan(&l.ID, &l.InvoiceID, &l.FeeItemID, &l.Description, &l.AmountMinor, &l.StudentID, &l.Term, &l.InvoiceStatus, &l.PaidMinor); err != nil {
			return nil, fmt.Errorf("scan line balance: %w", err)
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// LinesForUpdate locks the lines first so two confirmations for the same line queue up.
func (r *pgRepo) LinesForUpdate(ctx context.Context, studentID string, ids []string) ([]LineBalance, error) {
	if _, err := r.tx.Exec(ctx, `select l.id from payments.invoice_lines l join payments.invoices i on i.id = l.invoice_id
		where l.school_id = $1 and i.student_id = $2 and l.id = any($3::text[]::uuid[]) order by l.id for update of l`, r.school, studentID, ids); err != nil {
		return nil, fmt.Errorf("lock invoice lines: %w", err)
	}
	return r.scanBalances(ctx, lineBalanceSQL+` where l.school_id = $1 and i.student_id = $2 and l.id = any($3::text[]::uuid[]) order by l.id`, r.school, studentID, ids)
}

func (r *pgRepo) RefreshInvoiceStatuses(ctx context.Context, invoiceIDs []string) error {
	_, err := r.tx.Exec(ctx, `update payments.invoices i set updated_at = now(), status = case
			when p.paid >= i.total_minor then 'PAID' when p.paid > 0 then 'PARTIAL' else 'ISSUED' end
		from (select l.invoice_id, coalesce(sum(a.amount_minor), 0) as paid
			from payments.invoice_lines l
			left join payments.payment_allocations a on a.target_type = 'INVOICE_LINE' and a.target_id = l.id
			where l.invoice_id = any($2::text[]::uuid[]) group by l.invoice_id) p
		where i.id = p.invoice_id and i.school_id = $1`, r.school, invoiceIDs)
	if err != nil {
		return fmt.Errorf("refresh invoice statuses: %w", err)
	}
	return nil
}

func (r *pgRepo) StatementLines(ctx context.Context, studentID, term string, limit int) ([]LineBalance, error) {
	return r.scanBalances(ctx, lineBalanceSQL+` where l.school_id = $1 and i.student_id = $2 and ($3 = '' or i.term = $3) order by l.id limit $4`,
		r.school, studentID, term, limit)
}

const paymentCols = `id::text, coalesce(student_id::text, ''), coalesce(payer_user_id, ''), rail, coalesce(provider_transaction_id, ''),
	amount_minor, status, coalesce(failure_code, ''), idempotency_key, kind, array(select x::text from unnest(invoice_line_ids) x), created_at, updated_at`

func scanPayment(row pgx.Row, school string) (*Payment, error) {
	p := Payment{SchoolID: school}
	err := row.Scan(&p.ID, &p.StudentID, &p.PayerUserID, &p.Rail, &p.ProviderTransactionID, &p.AmountMinor, &p.Status,
		&p.FailureCode, &p.IdempotencyKey, &p.Kind, &p.InvoiceLineIDs, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("scan payment: %w", err)
	}
	return &p, nil
}

func (r *pgRepo) InsertPaymentIfNew(ctx context.Context, p Payment) (bool, error) {
	tag, err := r.tx.Exec(ctx, `insert into payments.payments (id, school_id, student_id, payer_user_id, rail, provider_transaction_id, amount_minor,
			status, failure_code, idempotency_key, kind, invoice_line_ids, created_at, updated_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[]::uuid[],$13,$14)
		on conflict (school_id, idempotency_key) do nothing`,
		p.ID, r.school, nullIf(p.StudentID), nullIf(p.PayerUserID), p.Rail, nullIf(p.ProviderTransactionID), p.AmountMinor,
		p.Status, nullIf(p.FailureCode), p.IdempotencyKey, p.Kind, nonNil(p.InvoiceLineIDs), p.CreatedAt, p.UpdatedAt)
	if err != nil {
		return false, mapErr("insert payment", err)
	}
	return tag.RowsAffected() == 1, nil
}

func (r *pgRepo) GetPayment(ctx context.Context, id string) (*Payment, error) {
	return scanPayment(r.tx.QueryRow(ctx, `select `+paymentCols+` from payments.payments where school_id = $1 and id = $2`, r.school, id), r.school)
}

func (r *pgRepo) GetPaymentByIdempotencyKey(ctx context.Context, key string) (*Payment, error) {
	return scanPayment(r.tx.QueryRow(ctx, `select `+paymentCols+` from payments.payments where school_id = $1 and idempotency_key = $2`, r.school, key), r.school)
}

// GetPaymentByProviderTxn locks the row so a repeated webhook cannot confirm twice.
func (r *pgRepo) GetPaymentByProviderTxn(ctx context.Context, rail, txnID string) (*Payment, error) {
	return scanPayment(r.tx.QueryRow(ctx, `select `+paymentCols+` from payments.payments
		where school_id = $1 and rail = $2 and provider_transaction_id = $3 for update`, r.school, rail, txnID), r.school)
}

func (r *pgRepo) UpdatePayment(ctx context.Context, p Payment) error {
	_, err := r.tx.Exec(ctx, `update payments.payments set student_id = $3, provider_transaction_id = $4, amount_minor = $5, status = $6,
			failure_code = $7, updated_at = $8 where school_id = $1 and id = $2`,
		r.school, p.ID, nullIf(p.StudentID), nullIf(p.ProviderTransactionID), p.AmountMinor, p.Status, nullIf(p.FailureCode), p.UpdatedAt)
	return mapErr("update payment", err)
}

func (r *pgRepo) ListPaymentsByStudent(ctx context.Context, studentID string, limit int) ([]PaymentSummary, error) {
	rows, err := r.tx.Query(ctx, `select p.id::text, p.rail, p.amount_minor, p.status, coalesce(p.failure_code, ''), coalesce(rc.number, ''), p.created_at
		from payments.payments p left join payments.receipts rc on rc.payment_id = p.id
		where p.school_id = $1 and p.student_id = $2 order by p.created_at desc limit $3`, r.school, studentID, limit)
	if err != nil {
		return nil, fmt.Errorf("list payments: %w", err)
	}
	defer rows.Close()
	var out []PaymentSummary
	for rows.Next() {
		var s PaymentSummary
		if err := rows.Scan(&s.ID, &s.Rail, &s.AmountMinor, &s.Status, &s.FailureCode, &s.ReceiptNumber, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan payment summary: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *pgRepo) InsertAllocations(ctx context.Context, allocs []Allocation) error {
	for _, a := range allocs {
		if _, err := r.tx.Exec(ctx, `insert into payments.payment_allocations (id, school_id, payment_id, target_type, target_id, amount_minor, created_at)
			values ($1,$2,$3,$4,$5,$6,$7)`, a.ID, r.school, a.PaymentID, a.TargetType, a.TargetID, a.AmountMinor, a.CreatedAt); err != nil {
			return mapErr("insert allocation", err)
		}
	}
	return nil
}

func (r *pgRepo) CreditAllocatedMinor(ctx context.Context, studentID string) (int64, error) {
	var sum int64
	err := r.tx.QueryRow(ctx, `select coalesce(sum(amount_minor), 0)::bigint from payments.payment_allocations
		where school_id = $1 and target_type = 'STUDENT_CREDIT' and target_id = $2`, r.school, studentID).Scan(&sum)
	if err != nil {
		return 0, fmt.Errorf("sum credit: %w", err)
	}
	return sum, nil
}

func (r *pgRepo) InsertLedgerEntry(ctx context.Context, e LedgerEntry) error {
	_, err := r.tx.Exec(ctx, `insert into payments.ledger_entries (id, school_id, student_id, account, kind, amount_minor, ref_type, ref_id, created_at)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, e.ID, r.school, nullIf(e.StudentID), e.Account, e.Kind, e.AmountMinor, e.RefType, e.RefID, e.CreatedAt)
	return mapErr("insert ledger entry", err)
}

func (r *pgRepo) LedgerBalance(ctx context.Context, account, studentID string) (int64, error) {
	var sum int64
	err := r.tx.QueryRow(ctx, `select coalesce(sum(amount_minor), 0)::bigint from payments.ledger_entries
		where school_id = $1 and account = $2 and student_id is not distinct from $3::uuid`, r.school, account, nullIf(studentID)).Scan(&sum)
	if err != nil {
		return 0, fmt.Errorf("sum ledger: %w", err)
	}
	return sum, nil
}

// NextReceiptNumber bumps a per-school counter; the row lock serialises concurrent confirmations.
func (r *pgRepo) NextReceiptNumber(ctx context.Context) (string, error) {
	var n int64
	err := r.tx.QueryRow(ctx, `insert into payments.receipt_counters (school_id, last_number) values ($1, 1)
		on conflict (school_id) do update set last_number = payments.receipt_counters.last_number + 1, updated_at = now()
		returning last_number`, r.school).Scan(&n)
	if err != nil {
		return "", fmt.Errorf("next receipt number: %w", err)
	}
	return fmt.Sprintf("RCT-%06d", n), nil
}

func (r *pgRepo) InsertReceipt(ctx context.Context, rc Receipt) error {
	_, err := r.tx.Exec(ctx, `insert into payments.receipts (id, school_id, payment_id, number, issued_at) values ($1,$2,$3,$4,$5)`,
		rc.ID, r.school, rc.PaymentID, rc.Number, rc.IssuedAt)
	return mapErr("insert receipt", err)
}

func (r *pgRepo) InsertUnmatched(ctx context.Context, u Unmatched) error {
	_, err := r.tx.Exec(ctx, `insert into payments.unmatched_payments (id, school_id, payment_id, reason, created_at) values ($1,$2,$3,$4,$5)`,
		u.ID, r.school, u.PaymentID, u.Reason, u.CreatedAt)
	return mapErr("insert unmatched", err)
}

func (r *pgRepo) GetUnmatchedForUpdate(ctx context.Context, paymentID string) (*Unmatched, error) {
	u := Unmatched{SchoolID: r.school}
	err := r.tx.QueryRow(ctx, `select id::text, payment_id::text, reason, coalesce(resolved_by, ''), resolved_at, created_at
		from payments.unmatched_payments where school_id = $1 and payment_id = $2 for update`, r.school, paymentID).
		Scan(&u.ID, &u.PaymentID, &u.Reason, &u.ResolvedBy, &u.ResolvedAt, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get unmatched: %w", err)
	}
	return &u, nil
}

func (r *pgRepo) MarkUnmatchedResolved(ctx context.Context, paymentID, resolvedBy string, at time.Time) error {
	_, err := r.tx.Exec(ctx, `update payments.unmatched_payments set resolved_by = $3, resolved_at = $4, updated_at = $4
		where school_id = $1 and payment_id = $2`, r.school, paymentID, resolvedBy, at)
	return mapErr("resolve unmatched", err)
}

func (r *pgRepo) ListUnmatched(ctx context.Context, includeResolved bool, after string, limit int) ([]UnmatchedView, error) {
	rows, err := r.tx.Query(ctx, `select u.payment_id::text, u.reason, p.rail, p.amount_minor, coalesce(p.student_id::text, ''),
			coalesce(p.provider_transaction_id, ''), u.created_at, coalesce(u.resolved_by, ''), u.resolved_at
		from payments.unmatched_payments u join payments.payments p on p.id = u.payment_id
		where u.school_id = $1 and ($2 or u.resolved_at is null) and u.payment_id > coalesce(nullif($3::text, '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		order by u.payment_id limit $4`, r.school, includeResolved, after, limit)
	if err != nil {
		return nil, fmt.Errorf("list unmatched: %w", err)
	}
	defer rows.Close()
	var out []UnmatchedView
	for rows.Next() {
		var v UnmatchedView
		if err := rows.Scan(&v.PaymentID, &v.Reason, &v.Rail, &v.AmountMinor, &v.StudentID, &v.ProviderTransactionID, &v.CreatedAt, &v.ResolvedBy, &v.ResolvedAt); err != nil {
			return nil, fmt.Errorf("scan unmatched: %w", err)
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (r *pgRepo) InsertOutbox(ctx context.Context, e OutboxEvent) error {
	_, err := r.tx.Exec(ctx, `insert into payments.outbox (id, school_id, event_type, aggregate_id, payload, created_at) values ($1,$2,$3,$4,$5,$6)`,
		e.ID, r.school, e.Type, e.AggregateID, []byte(e.Payload), e.CreatedAt)
	return mapErr("insert outbox", err)
}

func (r *pgRepo) InsertWebhookEvent(ctx context.Context, ev WebhookEvent) (bool, error) {
	return insertWebhookEvent(ctx, r.tx, ev)
}

func (r *pgRepo) Reconciliation(ctx context.Context, from, to time.Time, after string, limit int) ([]ReconRow, error) {
	rows, err := r.tx.Query(ctx, `select p.id::text, coalesce(rc.number, ''), coalesce(p.student_id::text, ''), p.rail,
			coalesce(p.provider_transaction_id, ''), p.status, p.amount_minor,
			coalesce(sum(a.amount_minor) filter (where a.target_type = 'INVOICE_LINE'), 0)::bigint,
			coalesce(sum(a.amount_minor) filter (where a.target_type = 'STUDENT_CREDIT'), 0)::bigint, p.created_at
		from payments.payments p
		left join payments.receipts rc on rc.payment_id = p.id
		left join payments.payment_allocations a on a.payment_id = p.id
		where p.school_id = $1 and p.created_at >= $2 and p.created_at < $3 and p.id > coalesce(nullif($4::text, '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
		group by p.id, rc.number order by p.id limit $5`, r.school, from, to, after, limit)
	if err != nil {
		return nil, fmt.Errorf("reconciliation: %w", err)
	}
	defer rows.Close()
	var out []ReconRow
	for rows.Next() {
		var x ReconRow
		if err := rows.Scan(&x.PaymentID, &x.ReceiptNumber, &x.StudentID, &x.Rail, &x.ProviderTransactionID, &x.Status,
			&x.AmountMinor, &x.AllocatedMinor, &x.CreditMinor, &x.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan reconciliation: %w", err)
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
