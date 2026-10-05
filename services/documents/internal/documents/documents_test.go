package documents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	kit "github.com/stackable/go-kit"
)

const (
	schoolA = "11111111-1111-4111-8111-111111111111"
	schoolB = "22222222-2222-4222-8222-222222222222"
	secret  = "test-secret"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

type env struct {
	svc    *Service
	store  *MemoryStore
	files  *LocalStore
	clock  *fakeClock
	router http.Handler
}

func newEnv(t *testing.T) *env {
	t.Helper()
	clock := &fakeClock{t: time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)}
	files, err := NewLocalStore(t.TempDir(), []byte("files-secret"), clock.Now)
	if err != nil {
		t.Fatal(err)
	}
	store := NewMemoryStore()
	svc := NewService(Config{
		Store: store, Objects: files, Clock: clock.Now,
		Renderers: map[Format]Renderer{FormatPDF: PDFRenderer{}, FormatXLSX: XLSXRenderer{}},
	})
	verifier, _ := kit.NewServiceTokenVerifier(secret, "gateway", "documents")
	r := kit.NewRouter(kit.Config{Name: "documents", Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))})
	NewHandler(svc, verifier, files).Routes(r)
	return &env{svc: svc, store: store, files: files, clock: clock, router: r}
}

func receiptData(lines int) json.RawMessage {
	var ls []string
	for i := 0; i < lines; i++ {
		ls = append(ls, fmt.Sprintf(`{"description":"Item %d","amountMinor":123456}`, i))
	}
	return json.RawMessage(`{"schoolName":"Green Hill Academy","receiptNo":"R-1","payerName":"A Parent","issuedAt":"2026-01-01","lines":[` + strings.Join(ls, ",") + `]}`)
}

func tableData(rows int) json.RawMessage {
	var rs []string
	for i := 0; i < rows; i++ {
		rs = append(rs, fmt.Sprintf(`{"name":"Student %d","fee":50000}`, i))
	}
	return json.RawMessage(`{"schoolName":"Green Hill Academy","title":"Class sheet","columns":[{"key":"name","label":"Name"},{"key":"fee","label":"Fee","money":true}],"rows":[` + strings.Join(rs, ",") + `]}`)
}

func receiptReq(version string) CreateRequest {
	return CreateRequest{Type: TypeReceipt, Format: FormatPDF, Params: json.RawMessage(`{"a":1,"b":2}`), DataVersion: version, Data: receiptData(2)}
}

func mustCreate(t *testing.T, e *env, school string, req CreateRequest) Result {
	t.Helper()
	res, err := e.svc.Create(context.Background(), school, req)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return res
}

func TestCacheHitVsMiss(t *testing.T) {
	e := newEnv(t)
	first := mustCreate(t, e, schoolA, receiptReq("v1"))
	second := mustCreate(t, e, schoolA, receiptReq("v1"))
	if first.Status != StatusStoredAndCached || first.RenderMs == nil || first.URL == "" {
		t.Fatalf("first: %+v", first)
	}
	if second.Status != StatusServed || second.ID != first.ID || second.URL == "" {
		t.Fatalf("second: %+v", second)
	}
	if e.store.DocumentCount() != 1 {
		t.Fatalf("documents = %d, want 1", e.store.DocumentCount())
	}
}

func TestParamOrderDoesNotChangeCacheKey(t *testing.T) {
	a, _ := CacheKey(schoolA, TypeGeneric, json.RawMessage(`{"a":1,"b":2}`), "v1", FormatPDF)
	b, _ := CacheKey(schoolA, TypeGeneric, json.RawMessage(`{ "b": 2, "a": 1 }`), "v1", FormatPDF)
	if a != b {
		t.Fatal("canonical params should give one key")
	}
}

func TestChangedDataVersionMissesCache(t *testing.T) {
	e := newEnv(t)
	v1 := mustCreate(t, e, schoolA, receiptReq("v1"))
	v2 := mustCreate(t, e, schoolA, receiptReq("v2"))
	if v2.Status != StatusStoredAndCached || v2.ID == v1.ID {
		t.Fatalf("v2 must be a fresh render, got %+v", v2)
	}
}

func TestExpiryPurgesCacheButKeepsDocumentAndFile(t *testing.T) {
	e := newEnv(t)
	first := mustCreate(t, e, schoolA, receiptReq("v1"))
	e.clock.Advance(CacheTTL + time.Second)

	n, err := e.svc.PurgeExpired(context.Background())
	if err != nil || n != 1 {
		t.Fatalf("purged %d, err %v", n, err)
	}
	if e.store.CacheCount() != 0 || e.store.DocumentCount() != 1 {
		t.Fatalf("cache %d docs %d", e.store.CacheCount(), e.store.DocumentCount())
	}
	doc, _ := e.store.GetDocument(context.Background(), schoolA, first.ID)
	if ok, _ := e.files.Exists(context.Background(), doc.ObjectKey); !ok {
		t.Fatal("stored file must survive the purge")
	}
	if again := mustCreate(t, e, schoolA, receiptReq("v1")); again.Status != StatusStoredAndCached {
		t.Fatalf("after expiry want a fresh render, got %s", again.Status)
	}
}

func TestExpiredEntryIsNotServedBeforePurge(t *testing.T) {
	e := newEnv(t)
	mustCreate(t, e, schoolA, receiptReq("v1"))
	e.clock.Advance(CacheTTL + time.Second)
	if res := mustCreate(t, e, schoolA, receiptReq("v1")); res.Status == StatusServed {
		t.Fatal("expired cache entry was served")
	}
}

func TestSmallRendersSyncLargeQueues(t *testing.T) {
	e := newEnv(t)
	small := mustCreate(t, e, schoolA, CreateRequest{Type: TypeClassSheet, Format: FormatXLSX, DataVersion: "v1", Data: tableData(SyncMaxRows)})
	if small.Status != StatusStoredAndCached {
		t.Fatalf("500 rows: %s", small.Status)
	}
	req := CreateRequest{Type: TypeClassSheet, Format: FormatXLSX, DataVersion: "v2", Data: tableData(SyncMaxRows + 1)}
	large := mustCreate(t, e, schoolA, req)
	if large.Status != StatusQueuedJob || large.URL != "" {
		t.Fatalf("501 rows: %+v", large)
	}
	view, _ := e.svc.Get(context.Background(), schoolA, large.ID)
	if view.Status != StatusQueuedJob || view.URL != "" {
		t.Fatalf("queued view: %+v", view)
	}

	more, err := e.svc.ProcessNext(context.Background())
	if err != nil || !more {
		t.Fatalf("process: %v %v", more, err)
	}
	view, _ = e.svc.Get(context.Background(), schoolA, large.ID)
	if view.Status != StatusStoredAndCached || view.URL == "" {
		t.Fatalf("done view: %+v", view)
	}
	out := e.store.Outbox()
	if len(out) != 1 || out[0].Topic != "document.ready" || out[0].SchoolID != schoolA {
		t.Fatalf("outbox: %+v", out)
	}
	if again := mustCreate(t, e, schoolA, req); again.Status != StatusServed || again.ID != large.ID {
		t.Fatalf("finished job should be cached: %+v", again)
	}
	if more, _ := e.svc.ProcessNext(context.Background()); more {
		t.Fatal("queue should be empty")
	}
}

func TestSignedURLExpiryAndTamper(t *testing.T) {
	e := newEnv(t)
	res := mustCreate(t, e, schoolA, receiptReq("v1"))
	req := httptest.NewRequest(http.MethodGet, res.URL, nil)
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	if rec.Code != 200 || !bytes.HasPrefix(rec.Body.Bytes(), []byte("%PDF")) {
		t.Fatalf("download: %d", rec.Code)
	}

	check := func(name, url, code string) {
		t.Helper()
		rec := httptest.NewRecorder()
		e.router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		var body struct{ Code string }
		_ = json.Unmarshal(rec.Body.Bytes(), &body)
		if rec.Code != 403 || body.Code != code {
			t.Fatalf("%s: %d %s", name, rec.Code, rec.Body.String())
		}
	}
	check("tampered sig", strings.Replace(res.URL, "sig=", "sig=00", 1), "DOCUMENT_LINK_INVALID")
	check("tampered expiry", strings.Replace(res.URL, "exp=", "exp=9", 1), "DOCUMENT_LINK_INVALID")
	check("other school key", strings.Replace(res.URL, schoolA, schoolB, 1), "DOCUMENT_LINK_INVALID")
	e.clock.Advance(URLTTL + time.Second)
	check("expired", res.URL, "DOCUMENT_LINK_EXPIRED")
}

func TestLocalStoreRejectsTraversalKeys(t *testing.T) {
	e := newEnv(t)
	for _, key := range []string{"../x", "a/../../x", "/etc/passwd", "a//b", ""} {
		if _, err := e.files.SignedURL(key, time.Minute); err == nil {
			t.Fatalf("key %q should be rejected", key)
		}
	}
}

func TestTenantIsolation(t *testing.T) {
	e := newEnv(t)
	a := mustCreate(t, e, schoolA, receiptReq("v1"))
	b := mustCreate(t, e, schoolB, receiptReq("v1"))
	if b.Status != StatusStoredAndCached || b.ID == a.ID {
		t.Fatalf("school B must not hit school A cache: %+v", b)
	}
	if _, err := e.svc.Get(context.Background(), schoolB, a.ID); err == nil {
		t.Fatal("school B read school A document")
	}
	if _, err := e.svc.Get(context.Background(), schoolA, a.ID); err != nil {
		t.Fatalf("owner read failed: %v", err)
	}
}

func TestRenderersProduceRealFiles(t *testing.T) {
	ctx := context.Background()
	rc, _ := ParseContent(TypeReceipt, receiptData(3))
	tc, _ := ParseContent(TypeGeneric, tableData(120)) // 120 rows forces a second PDF page
	cases := []struct {
		name  string
		r     Renderer
		c     Content
		magic string
	}{
		{"pdf receipt", PDFRenderer{}, rc, "%PDF"},
		{"pdf table", PDFRenderer{}, tc, "%PDF"},
		{"xlsx receipt", XLSXRenderer{}, rc, "PK"},
		{"xlsx table", XLSXRenderer{}, tc, "PK"},
	}
	for _, c := range cases {
		out, err := c.r.Render(ctx, c.c)
		if err != nil || len(out) == 0 || !bytes.HasPrefix(out, []byte(c.magic)) {
			t.Fatalf("%s: err %v len %d", c.name, err, len(out))
		}
	}
}

func TestFormatKES(t *testing.T) {
	cases := map[int64]string{123456: "KES 1,234.56", 0: "KES 0.00", 5: "KES 0.05", 100: "KES 1.00", 100000000: "KES 1,000,000.00", -500: "-KES 5.00"}
	for in, want := range cases {
		if got := FormatKES(in); got != want {
			t.Errorf("FormatKES(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestReceiptPdfShowsFormattedAmounts(t *testing.T) {
	c, _ := ParseContent(TypeReceipt, json.RawMessage(`{"schoolName":"S","receiptNo":"1","lines":[{"description":"Fee","amountMinor":123456}]}`))
	out, err := PDFRenderer{Uncompressed: true}.Render(context.Background(), c)
	if err != nil || !bytes.Contains(out, []byte("KES 1,234.56")) {
		t.Fatalf("receipt pdf lacks formatted amount, err %v", err)
	}
}

func TestOneReceiptRendersUnder500ms(t *testing.T) {
	e := newEnv(t)
	start := time.Now()
	mustCreate(t, e, schoolA, receiptReq("fast"))
	if d := time.Since(start); d > 500*time.Millisecond {
		t.Fatalf("receipt took %s", d)
	}
}

func TestInvalidMoneyCellIsRejected(t *testing.T) {
	data := json.RawMessage(`{"schoolName":"S","columns":[{"key":"fee","label":"Fee","money":true}],"rows":[{"fee":12.5}]}`)
	_, err := ParseContent(TypeGeneric, data)
	if err == nil {
		t.Fatal("float money must be rejected")
	}
}

func token(t *testing.T, school string) string {
	t.Helper()
	tok, err := kit.SignServiceToken(secret, kit.ServiceClaims{SchoolID: school, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: "gateway", Audience: jwt.ClaimStrings{"documents"}, Subject: "user-1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func call(e *env, method, path, tok, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	return rec
}

func TestHTTPFlow(t *testing.T) {
	e := newEnv(t)
	tok := token(t, schoolA)
	body := `{"type":"receipt","format":"pdf","dataVersion":"v1","params":{},"data":` + string(receiptData(1)) + `}`

	if rec := call(e, "POST", "/v1/documents", "", body); rec.Code != 401 {
		t.Fatalf("no token: %d", rec.Code)
	}
	created := call(e, "POST", "/v1/documents", tok, body)
	if created.Code != 201 {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	if served := call(e, "POST", "/v1/documents", tok, body); served.Code != 200 || !strings.Contains(served.Body.String(), "SERVED") {
		t.Fatalf("served: %d %s", served.Code, served.Body.String())
	}
	var res Result
	_ = json.Unmarshal(created.Body.Bytes(), &res)
	if got := call(e, "GET", "/v1/documents/"+res.ID, tok, ""); got.Code != 200 || !strings.Contains(got.Body.String(), "url") {
		t.Fatalf("get: %d %s", got.Code, got.Body.String())
	}
	if other := call(e, "GET", "/v1/documents/"+res.ID, token(t, schoolB), ""); other.Code != 404 {
		t.Fatalf("other school: %d", other.Code)
	}
	if bad := call(e, "GET", "/v1/documents/not-a-uuid", tok, ""); bad.Code != 404 {
		t.Fatalf("bad id: %d", bad.Code)
	}
}

func TestHTTPValidationUsesEnvelope(t *testing.T) {
	e := newEnv(t)
	rec := call(e, "POST", "/v1/documents", token(t, schoolA), `{"type":"nope","format":"doc","data":{}}`)
	var body struct {
		Error, Code, RequestID string
		Details                struct{ Fields []fieldError }
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != 400 || body.Code != "VALIDATION_FAILED" || body.RequestID == "" || len(body.Details.Fields) < 3 {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
}

func TestS3PresignedURL(t *testing.T) {
	s, err := NewS3Store(S3Config{Endpoint: "https://acct.r2.cloudflarestorage.com", AccessKeyID: "id", SecretAccessKey: "sec", Bucket: "docs"})
	if err != nil {
		t.Fatal(err)
	}
	url, err := s.SignedURL(schoolA+"/x.pdf", time.Minute)
	if err != nil || !strings.Contains(url, "X-Amz-Signature") || !strings.Contains(url, "X-Amz-Expires=60") {
		t.Fatalf("url %q err %v", url, err)
	}
	if _, err := NewS3Store(S3Config{Endpoint: "x"}); err == nil {
		t.Fatal("partial config must fail")
	}
}
