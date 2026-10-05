package fees

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	kit "github.com/stackable/go-kit"
	"github.com/stackable/payments/internal/provider"
)

const (
	testSecret = "test-secret"
	schoolA    = "11111111-1111-4111-8111-111111111111"
	schoolB    = "22222222-2222-4222-8222-222222222222"
	studentA   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	studentB   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
)

type countingProvider struct {
	provider.Fake
	calls atomic.Int32
}

func (c *countingProvider) Initiate(ctx context.Context, p provider.Payment) (provider.Ref, error) {
	c.calls.Add(1)
	return c.Fake.Initiate(ctx, p)
}

type failingProvider struct {
	provider.Fake
	err error
}

func (f failingProvider) Initiate(context.Context, provider.Payment) (provider.Ref, error) {
	return provider.Ref{}, f.err
}

type env struct {
	t     *testing.T
	store *MemoryStore
	svc   *Service
	h     http.Handler
	fake  *countingProvider
}

func newEnv(t *testing.T) *env {
	t.Helper()
	return newEnvWith(t, NewMemoryStore(), nil)
}

func newEnvWith(t *testing.T, store Store, prov provider.PaymentProvider) *env {
	t.Helper()
	fake := &countingProvider{}
	if prov == nil {
		prov = fake
	}
	svc := NewService(store, prov)
	v, err := kit.NewServiceTokenVerifier(testSecret, "stackable-gateway", "payments")
	if err != nil {
		t.Fatal(err)
	}
	r := kit.NewRouter(kit.Config{Name: "payments", Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))})
	NewHandler(svc).Routes(r, kit.RequireServiceToken(v))
	ms, _ := store.(*MemoryStore)
	return &env{t: t, store: ms, svc: svc, h: r, fake: fake}
}

func (e *env) token(school string) string {
	tok, err := kit.SignServiceToken(testSecret, kit.ServiceClaims{SchoolID: school, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: "stackable-gateway", Audience: jwt.ClaimStrings{"payments"}, Subject: "user-1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute))}})
	if err != nil {
		e.t.Fatal(err)
	}
	return tok
}

func (e *env) call(school, method, path, body string) (int, map[string]any) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if school != "" {
		req.Header.Set("Authorization", "Bearer "+e.token(school))
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

// debt issues one invoice with the given line amounts and returns the line ids.
func (e *env) debt(school, student string, amounts ...int64) []string {
	e.t.Helper()
	var lines []LineInput
	for i, a := range amounts {
		lines = append(lines, LineInput{Description: fmt.Sprintf("Item %d", i), AmountMinor: a})
	}
	invs, err := e.svc.IssueInvoices(context.Background(), school, IssueInvoicesInput{StudentIDs: []string{student}, Term: "2026-T1", Lines: lines})
	if err != nil {
		e.t.Fatal(err)
	}
	var ids []string
	for _, l := range invs[0].Lines {
		ids = append(ids, l.ID)
	}
	return ids
}

func (e *env) intent(school, student, key string, amount int64, lines []string) Payment {
	e.t.Helper()
	p, _, err := e.svc.CreateIntent(context.Background(), school, "user-1", IntentInput{StudentID: student, AmountMinor: amount, Rail: RailFake, InvoiceLineIDs: lines, IdempotencyKey: key})
	if err != nil {
		e.t.Fatal(err)
	}
	return p
}

func (e *env) webhook(eventID string, p Payment, extra string) (WebhookResult, error) {
	body := fmt.Sprintf(`{"id":%q,"transactionId":%q%s}`, eventID, p.ProviderTransactionID, extra)
	return e.svc.ReceiveWebhook(context.Background(), "fake", http.Header{}, []byte(body))
}

func (e *env) balance(school, student string) int64 {
	e.t.Helper()
	var b int64
	_ = e.store.InTx(context.Background(), school, func(r Repo) (err error) {
		b, err = r.LedgerBalance(context.Background(), AccountReceivable, student)
		return err
	})
	return b
}

func (e *env) ledgerSum(school, student string) int64 {
	e.store.mu.Lock()
	defer e.store.mu.Unlock()
	var sum int64
	for _, l := range e.store.state.ledger {
		if l.SchoolID == school && l.StudentID == student && l.Account == AccountReceivable {
			sum += l.AmountMinor
		}
	}
	return sum
}

func TestWebhookAppliedOnceUnder50ConcurrentDeliveries(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 100000)
	pay := e.intent(schoolA, studentA, "k1", 100000, lines)

	var wg sync.WaitGroup
	var fresh atomic.Int32
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := e.webhook("evt-1", pay, "")
			if err != nil {
				t.Error(err)
			} else if !res.Duplicate {
				fresh.Add(1)
			}
		}()
	}
	wg.Wait()

	if fresh.Load() != 1 {
		t.Fatalf("%d deliveries were applied, want 1", fresh.Load())
	}
	e.store.mu.Lock()
	defer e.store.mu.Unlock()
	st := e.store.state
	if len(st.receipts) != 1 || len(st.allocations) != 1 || len(st.outbox) != 1 || st.outbox[0].Type != "payment.confirmed" {
		t.Fatalf("receipts %d allocations %d outbox %d", len(st.receipts), len(st.allocations), len(st.outbox))
	}
	if got := st.payments[pay.ID].Status; got != StatusConfirmed {
		t.Fatalf("status %s", got)
	}
}

func TestLedgerBalanceEqualsSumAndStatementAgrees(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 30000, 20000)
	pay := e.intent(schoolA, studentA, "k1", 30000, lines[:1])
	if _, err := e.webhook("e1", pay, ""); err != nil {
		t.Fatal(err)
	}
	if got, want := e.balance(schoolA, studentA), e.ledgerSum(schoolA, studentA); got != want || got != 20000 {
		t.Fatalf("balance %d, sum %d, want 20000", got, want)
	}
	st, err := e.svc.GetStatement(context.Background(), schoolA, studentA, "")
	if err != nil {
		t.Fatal(err)
	}
	var termBalance int64
	for _, term := range st.Terms {
		termBalance += term.BalanceMinor
	}
	if st.BalanceMinor != termBalance-st.CreditMinor || len(st.Payments) != 1 || st.Payments[0].ReceiptNumber != "RCT-000001" {
		t.Fatalf("statement %+v", st)
	}
}

func TestPartialPaymentAllocation(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 50000, 50000)
	pay := e.intent(schoolA, studentA, "k1", 70000, lines)
	if _, err := e.webhook("e1", pay, ""); err != nil {
		t.Fatal(err)
	}
	st, _ := e.svc.GetStatement(context.Background(), schoolA, studentA, "")
	got := st.Terms[0].Lines
	paid := map[string]int64{got[0].LineID: got[0].PaidMinor, got[1].LineID: got[1].PaidMinor}
	if paid[lines[0]] != 50000 || paid[lines[1]] != 20000 || st.BalanceMinor != 30000 || st.CreditMinor != 0 {
		t.Fatalf("paid %v statement %+v", paid, st)
	}
}

func TestOverpaymentBecomesStudentCredit(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 100000)
	first := e.intent(schoolA, studentA, "k1", 100000, lines)
	second := e.intent(schoolA, studentA, "k2", 100000, lines) // both were valid when created
	_, _ = e.webhook("e1", first, "")
	_, _ = e.webhook("e2", second, "")
	st, _ := e.svc.GetStatement(context.Background(), schoolA, studentA, "")
	if st.CreditMinor != 100000 || st.BalanceMinor != -100000 || st.Terms[0].BalanceMinor != 0 {
		t.Fatalf("statement %+v", st)
	}
}

func TestIntentAboveOutstandingIsRejected(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	_, _, err := e.svc.CreateIntent(context.Background(), schoolA, "u", IntentInput{StudentID: studentA, AmountMinor: 10001, Rail: RailFake, InvoiceLineIDs: lines, IdempotencyKey: "k"})
	var app *kit.AppError
	if !errors.As(err, &app) || app.Code != "PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING" {
		t.Fatalf("err %v", err)
	}
}

func TestUnmatchedQueueAndResolve(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 40000)
	body := fmt.Sprintf(`{"id":"ext-1","amountMinor":40000,"schoolId":%q}`, schoolA)
	res, err := e.svc.ReceiveWebhook(context.Background(), "fake", http.Header{}, []byte(body))
	if err != nil || res.Outcome != OutcomeUnmatched {
		t.Fatalf("%+v %v", res, err)
	}
	rows, _ := e.svc.ListUnmatched(context.Background(), schoolA, false, "", 10)
	if len(rows) != 1 || rows[0].Reason != ReasonNoMatchingPayment || e.suspense(schoolA) != -40000 {
		t.Fatalf("rows %+v suspense %d", rows, e.suspense(schoolA))
	}
	if e.balance(schoolA, studentA) != 40000 {
		t.Fatal("unmatched money must not touch the student balance yet")
	}

	pay, err := e.svc.ResolveUnmatched(context.Background(), schoolA, "finance-1", rows[0].PaymentID, ResolveInput{StudentID: studentA, InvoiceLineIDs: lines})
	if err != nil || pay.Status != StatusConfirmed {
		t.Fatalf("%+v %v", pay, err)
	}
	if e.suspense(schoolA) != 0 || e.balance(schoolA, studentA) != 0 {
		t.Fatalf("suspense %d balance %d", e.suspense(schoolA), e.balance(schoolA, studentA))
	}
	if open, _ := e.svc.ListUnmatched(context.Background(), schoolA, false, "", 10); len(open) != 0 {
		t.Fatalf("queue still has %d open rows", len(open))
	}
	_, err = e.svc.ResolveUnmatched(context.Background(), schoolA, "finance-1", rows[0].PaymentID, ResolveInput{StudentID: studentA})
	var app *kit.AppError
	if !errors.As(err, &app) || app.Code != "PAYMENT_ALREADY_RESOLVED" {
		t.Fatalf("second resolve: %v", err)
	}
}

func (e *env) suspense(school string) int64 {
	var b int64
	_ = e.store.InTx(context.Background(), school, func(r Repo) (err error) {
		b, err = r.LedgerBalance(context.Background(), AccountSuspense, "")
		return err
	})
	return b
}

func TestAmountMismatchGoesToUnmatched(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	pay := e.intent(schoolA, studentA, "k1", 10000, lines)
	res, err := e.webhook("e1", pay, `,"amountMinor":99999`)
	if err != nil || res.Outcome != OutcomeUnmatched {
		t.Fatalf("%+v %v", res, err)
	}
	if e.balance(schoolA, studentA) != 10000 {
		t.Fatal("a mismatched amount must not credit the student")
	}
}

func TestFailedThenLateSuccessChangesNothing(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	pay := e.intent(schoolA, studentA, "k1", 10000, lines)
	if res, _ := e.webhook("e1", pay, `,"status":"failed","failureCode":"WRONG_PIN"`); res.Outcome != OutcomeFailed {
		t.Fatalf("%+v", res)
	}
	if res, _ := e.webhook("e2", pay, ""); res.Outcome != OutcomeIgnored {
		t.Fatalf("%+v", res)
	}
	got, _ := e.svc.GetPayment(context.Background(), schoolA, pay.ID)
	if got.Status != StatusFailed || got.FailureCode != "WRONG_PIN" || e.balance(schoolA, studentA) != 10000 {
		t.Fatalf("%+v", got)
	}
}

func TestIdempotentIntent(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	body := fmt.Sprintf(`{"studentId":%q,"amountMinor":10000,"rail":"fake","invoiceLineIds":[%q],"idempotencyKey":"key-1"}`, studentA, lines[0])
	c1, a := e.call(schoolA, "POST", "/v1/payments/intent", body)
	c2, b := e.call(schoolA, "POST", "/v1/payments/intent", body)
	if c1 != 201 || c2 != 200 || a["id"] != b["id"] || e.fake.calls.Load() != 1 {
		t.Fatalf("%d %d %v %v calls=%d", c1, c2, a, b, e.fake.calls.Load())
	}
	other := strings.Replace(body, "10000,", "5000,", 1)
	if c, out := e.call(schoolA, "POST", "/v1/payments/intent", other); c != 409 || out["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("%d %v", c, out)
	}
}

func TestIdempotentIntentUnderConcurrency(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	var wg sync.WaitGroup
	ids := sync.Map{}
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p, _, err := e.svc.CreateIntent(context.Background(), schoolA, "u", IntentInput{StudentID: studentA, AmountMinor: 10000, Rail: RailFake, InvoiceLineIDs: lines, IdempotencyKey: "same"})
			if err != nil {
				t.Error(err)
				return
			}
			ids.Store(p.ID, true)
		}()
	}
	wg.Wait()
	n := 0
	ids.Range(func(any, any) bool { n++; return true })
	if n != 1 || e.fake.calls.Load() != 1 {
		t.Fatalf("%d payments, %d provider calls", n, e.fake.calls.Load())
	}
}

// receiptFailStore makes the receipt insert fail so we can prove the whole confirmation rolls back.
type receiptFailStore struct{ Store }

type receiptFailRepo struct{ Repo }

func (receiptFailRepo) InsertReceipt(context.Context, Receipt) error {
	return errors.New("receipt insert failed")
}

func (s receiptFailStore) InTx(ctx context.Context, school string, fn func(Repo) error) error {
	return s.Store.InTx(ctx, school, func(r Repo) error { return fn(receiptFailRepo{r}) })
}

func TestFailingReceiptRollsBackLedgerCredit(t *testing.T) {
	mem := NewMemoryStore()
	good := newEnvWith(t, mem, nil)
	lines := good.debt(schoolA, studentA, 10000)
	pay := good.intent(schoolA, studentA, "k1", 10000, lines)

	bad := newEnvWith(t, receiptFailStore{mem}, nil)
	if _, err := bad.webhook("e1", pay, ""); err == nil {
		t.Fatal("expected the failing receipt to fail the webhook")
	}
	mem.mu.Lock()
	st := mem.state
	untouched := len(st.ledger) == 1 && len(st.allocations) == 0 && len(st.outbox) == 0 && st.payments[pay.ID].Status == StatusPending && len(st.events) == 0
	mem.mu.Unlock()
	if !untouched {
		t.Fatalf("partial writes survived: ledger %d allocations %d outbox %d events %d", len(st.ledger), len(st.allocations), len(st.outbox), len(st.events))
	}
	// the provider retry on a healthy service still confirms it
	if res, err := good.webhook("e1", pay, ""); err != nil || res.Outcome != OutcomeConfirmed {
		t.Fatalf("%+v %v", res, err)
	}
}

func TestTenantIsolation(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	pay := e.intent(schoolA, studentA, "k1", 10000, lines)

	st, _ := e.svc.GetStatement(context.Background(), schoolB, studentA, "")
	if len(st.Terms) != 0 || st.BalanceMinor != 0 || len(st.Payments) != 0 {
		t.Fatalf("school B saw %+v", st)
	}
	_, _, err := e.svc.CreateIntent(context.Background(), schoolB, "u", IntentInput{StudentID: studentA, AmountMinor: 100, Rail: RailFake, InvoiceLineIDs: lines, IdempotencyKey: "kb"})
	var app *kit.AppError
	if !errors.As(err, &app) || app.Code != "INVOICE_LINE_NOT_FOUND" {
		t.Fatalf("cross-school intent: %v", err)
	}
	if _, err := e.svc.GetPayment(context.Background(), schoolB, pay.ID); err == nil {
		t.Fatal("school B read school A's payment")
	}
	// same idempotency key in another school is a different payment
	e.debt(schoolB, studentB, 10000)
	if code, out := e.call(schoolB, "GET", "/v1/payments/"+pay.ID, ""); code != 404 || out["code"] != "PAYMENT_NOT_FOUND" {
		t.Fatalf("%d %v", code, out)
	}
	// a park by school A is not resolvable by school B
	body := fmt.Sprintf(`{"id":"x1","amountMinor":500,"schoolId":%q}`, schoolA)
	_, _ = e.svc.ReceiveWebhook(context.Background(), "fake", http.Header{}, []byte(body))
	rowsA, _ := e.svc.ListUnmatched(context.Background(), schoolA, false, "", 10)
	if _, err := e.svc.ResolveUnmatched(context.Background(), schoolB, "x", rowsA[0].PaymentID, ResolveInput{StudentID: studentB}); err == nil {
		t.Fatal("school B resolved school A's unmatched payment")
	}
	if rowsB, _ := e.svc.ListUnmatched(context.Background(), schoolB, false, "", 10); len(rowsB) != 0 {
		t.Fatal("school B sees A's queue")
	}
}

func TestProviderErrorsMapToDistinctCodes(t *testing.T) {
	cases := []struct {
		fail   provider.FailureCode
		status int
	}{
		{provider.InsufficientFunds, 402}, {provider.WrongPin, 402}, {provider.UserCancelled, 402},
		{provider.Timeout, 504}, {provider.RailDown, 503},
	}
	for _, c := range cases {
		t.Run(string(c.fail), func(t *testing.T) {
			e := newEnvWith(t, NewMemoryStore(), failingProvider{err: &provider.Error{Code: c.fail, Message: "x"}})
			lines := e.debt(schoolA, studentA, 10000)
			body := fmt.Sprintf(`{"studentId":%q,"amountMinor":10000,"rail":"fake","invoiceLineIds":[%q],"idempotencyKey":"k"}`, studentA, lines[0])
			code, out := e.call(schoolA, "POST", "/v1/payments/intent", body)
			if code != c.status || out["code"] != "PAYMENT_"+string(c.fail) {
				t.Fatalf("%d %v", code, out)
			}
			details, _ := out["details"].(map[string]any)
			pay, err := e.svc.GetPayment(context.Background(), schoolA, fmt.Sprint(details["paymentId"]))
			if err != nil || pay.Status != StatusFailed || pay.FailureCode != string(c.fail) {
				t.Fatalf("%+v %v", pay, err)
			}
		})
	}
}

func TestFakePhoneTriggersTimeout(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	_, _, err := e.svc.CreateIntent(context.Background(), schoolA, "u", IntentInput{StudentID: studentA, AmountMinor: 100, Rail: RailFake, InvoiceLineIDs: lines, IdempotencyKey: "k", PayerPhone: provider.FakePhoneTimeout})
	var app *kit.AppError
	if !errors.As(err, &app) || app.Code != "PAYMENT_TIMEOUT" {
		t.Fatalf("%v", err)
	}
}

func TestDisabledAndUnsupportedRails(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	mk := func(rail string) string {
		return fmt.Sprintf(`{"studentId":%q,"amountMinor":100,"rail":%q,"invoiceLineIds":[%q],"idempotencyKey":"k-%s","payerPhone":"0712345678"}`, studentA, rail, lines[0], rail)
	}
	if code, out := e.call(schoolA, "POST", "/v1/payments/intent", mk("mpesa")); code != 503 || out["code"] != "PAYMENT_RAIL_DOWN" {
		t.Fatalf("mpesa off: %d %v", code, out)
	}
	if code, out := e.call(schoolA, "POST", "/v1/payments/intent", mk("card")); code != 422 || out["code"] != "PAYMENT_RAIL_UNSUPPORTED" {
		t.Fatalf("card: %d %v", code, out)
	}
}

func TestInvoiceIssueFromStructureIsAtomicAndNotRepeatable(t *testing.T) {
	e := newEnv(t)
	code, fs := e.call(schoolA, "POST", "/v1/fee-structures", `{"name":"Day scholar","term":"2026-T1","level":"Grade 4","items":[{"name":"Tuition","amountMinor":5000000,"mandatory":true},{"name":"Trip","amountMinor":100000,"mandatory":false}]}`)
	if code != 201 {
		t.Fatalf("%d %v", code, fs)
	}
	if code, out := e.call(schoolA, "POST", "/v1/fee-structures", `{"name":"Day scholar","term":"2026-T1","level":"Grade 4","items":[{"name":"X","amountMinor":1,"mandatory":true}]}`); code != 409 || out["code"] != "FEE_STRUCTURE_EXISTS" {
		t.Fatalf("%d %v", code, out)
	}
	body := fmt.Sprintf(`{"studentIds":[%q],"feeStructureId":%q}`, studentA, fs["id"])
	if code, out := e.call(schoolA, "POST", "/v1/invoices", body); code != 201 {
		t.Fatalf("%d %v", code, out)
	}
	both := fmt.Sprintf(`{"studentIds":[%q,%q],"feeStructureId":%q}`, studentB, studentA, fs["id"])
	if code, out := e.call(schoolA, "POST", "/v1/invoices", both); code != 409 || out["code"] != "INVOICE_ALREADY_ISSUED" {
		t.Fatalf("%d %v", code, out)
	}
	if e.balance(schoolA, studentA) != 5000000 || e.balance(schoolA, studentB) != 0 {
		t.Fatalf("balances %d %d: the failed run must not leave student B debited", e.balance(schoolA, studentA), e.balance(schoolA, studentB))
	}
}

func TestValidationAndAuthAtTheGate(t *testing.T) {
	e := newEnv(t)
	if code, out := e.call("", "GET", "/v1/unmatched", ""); code != 401 || out["code"] != "AUTH_UNAUTHORIZED" {
		t.Fatalf("%d %v", code, out)
	}
	if code, out := e.call(schoolA, "POST", "/v1/payments/intent", `{"amountMinor":-5}`); code != 400 || out["code"] != "VALIDATION_FAILED" || out["requestId"] == "" {
		t.Fatalf("%d %v", code, out)
	}
	if code, _ := e.call(schoolA, "GET", "/v1/students/not-a-uuid/statement", ""); code != 400 {
		t.Fatalf("bad path id: %d", code)
	}
	if code, _ := e.call(schoolA, "GET", "/v1/reconciliation?from=2026-02-01&to=2026-01-01", ""); code != 400 {
		t.Fatalf("bad range: %d", code)
	}
}

func TestReconciliationRows(t *testing.T) {
	e := newEnv(t)
	lines := e.debt(schoolA, studentA, 10000)
	pay := e.intent(schoolA, studentA, "k1", 10000, lines)
	_, _ = e.webhook("e1", pay, "")
	from := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	to := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	code, out := e.call(schoolA, "GET", "/v1/reconciliation?from="+from+"&to="+to, "")
	rows, _ := out["rows"].([]any)
	if code != 200 || len(rows) != 1 {
		t.Fatalf("%d %v", code, out)
	}
	row := rows[0].(map[string]any)
	if row["status"] != StatusConfirmed || row["allocatedMinor"] != float64(10000) || row["receiptNumber"] != "RCT-000001" {
		t.Fatalf("%v", row)
	}
	if code, out := e.call(schoolB, "GET", "/v1/reconciliation?from="+from+"&to="+to, ""); code != 200 || len(out["rows"].([]any)) != 0 {
		t.Fatalf("school B rows: %v", out)
	}
}

func TestWebhookEdgeCases(t *testing.T) {
	e := newEnv(t)
	post := func(path, body string) (int, map[string]any) { return e.call("", "POST", path, body) }
	if code, out := post("/v1/webhooks/nope", `{"id":"1"}`); code != 404 || out["code"] != "RESOURCE_NOT_FOUND" {
		t.Fatalf("%d %v", code, out)
	}
	if code, out := post("/v1/webhooks/fake", `not json`); code != 400 || out["code"] != "WEBHOOK_INVALID" {
		t.Fatalf("%d %v", code, out)
	}
	// an event for an unknown school is stored once and applied to nothing
	for i, want := range []bool{false, true} {
		code, out := post("/v1/webhooks/fake", `{"id":"orphan-1","amountMinor":5}`)
		if code != 200 || out["duplicate"] != want || out["outcome"] != OutcomeRecorded {
			t.Fatalf("delivery %d: %d %v", i, code, out)
		}
	}
	if e.store.EventCount() != 1 {
		t.Fatalf("%d events stored", e.store.EventCount())
	}
}
