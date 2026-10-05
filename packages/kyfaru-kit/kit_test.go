package kit

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	testSecret   = "test-secret-test-secret-test-secret"
	testIssuer   = "gateway"
	testAudience = "payments"
)

func quietLogger() *slog.Logger { return slog.New(slog.NewJSONHandler(io.Discard, nil)) }

func do(t *testing.T, h http.Handler, method, path string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("body is not JSON: %q", rec.Body.String())
	}
	return out
}

func TestErrorEnvelope(t *testing.T) {
	cases := []struct {
		err    *AppError
		status int
		code   string
	}{
		{Validation("bad", map[string]string{"email": "required"}), 400, "VALIDATION_FAILED"},
		{Unauthorized("no"), 401, "AUTH_UNAUTHORIZED"},
		{Forbidden("no"), 403, "AUTH_FORBIDDEN"},
		{NotFound("no"), 404, "RESOURCE_NOT_FOUND"},
		{Conflict("no"), 409, "RESOURCE_CONFLICT"},
		{RateLimited("no"), 429, "RATE_LIMITED"},
		{Upstream("no"), 502, "UPSTREAM_FAILED"},
		{Unavailable("no"), 503, "SERVICE_UNAVAILABLE"},
		{Internal(), 500, "INTERNAL_ERROR"},
	}
	for _, c := range cases {
		t.Run(c.code, func(t *testing.T) {
			r := NewRouter(Config{Name: "t", Logger: quietLogger()})
			r.Get("/x", Handle(func(w http.ResponseWriter, r *http.Request) error { return c.err }))
			rec := do(t, r, "GET", "/x", map[string]string{"X-Request-Id": "req-1"})
			body := decode(t, rec)
			if rec.Code != c.status || body["code"] != c.code || body["requestId"] != "req-1" || body["error"] == "" {
				t.Fatalf("got %d %v", rec.Code, body)
			}
		})
	}
}

func TestValidationDetailsAreReturned(t *testing.T) {
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	r.Get("/x", Handle(func(w http.ResponseWriter, r *http.Request) error {
		return Validation("bad", map[string]string{"email": "required"})
	}))
	body := decode(t, do(t, r, "GET", "/x", nil))
	details, _ := body["details"].(map[string]any)
	if details["email"] != "required" {
		t.Fatalf("details missing: %v", body)
	}
}

func TestUnknownErrorDoesNotLeak(t *testing.T) {
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	r.Get("/x", Handle(func(w http.ResponseWriter, r *http.Request) error {
		return errors.New("password=hunter2 at db.internal:5432")
	}))
	rec := do(t, r, "GET", "/x", nil)
	if rec.Code != 500 || strings.Contains(rec.Body.String(), "hunter2") {
		t.Fatalf("leaked or wrong status: %d %s", rec.Code, rec.Body.String())
	}
}

func TestPanicIsRecoveredWithoutLeak(t *testing.T) {
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	r.Get("/boom", func(w http.ResponseWriter, r *http.Request) { panic("secret internal detail") })
	rec := do(t, r, "GET", "/boom", nil)
	body := decode(t, rec)
	if rec.Code != 500 || body["code"] != "INTERNAL_ERROR" || strings.Contains(rec.Body.String(), "secret") {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
}

func TestNotFoundAndMethodNotAllowedUseEnvelope(t *testing.T) {
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	if body := decode(t, do(t, r, "GET", "/nope", nil)); body["code"] != "RESOURCE_NOT_FOUND" {
		t.Fatalf("404 body: %v", body)
	}
	if rec := do(t, r, "POST", "/health", nil); rec.Code != 405 || decode(t, rec)["code"] != "METHOD_NOT_ALLOWED" {
		t.Fatalf("405: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRequestID(t *testing.T) {
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	t.Run("reuses a safe incoming id", func(t *testing.T) {
		rec := do(t, r, "GET", "/health", map[string]string{"X-Request-Id": "abc-123"})
		if got := rec.Header().Get("X-Request-Id"); got != "abc-123" {
			t.Fatalf("got %q", got)
		}
	})
	t.Run("generates one when missing", func(t *testing.T) {
		if got := do(t, r, "GET", "/health", nil).Header().Get("X-Request-Id"); len(got) != 32 {
			t.Fatalf("got %q", got)
		}
	})
	t.Run("replaces an unsafe id", func(t *testing.T) {
		got := do(t, r, "GET", "/health", map[string]string{"X-Request-Id": "bad id\twith spaces"}).Header().Get("X-Request-Id")
		if got == "bad id\twith spaces" || len(got) != 32 {
			t.Fatalf("got %q", got)
		}
	})
	t.Run("is available in the handler context", func(t *testing.T) {
		var seen string
		r.Get("/ctx", func(w http.ResponseWriter, r *http.Request) { seen = RequestID(r.Context()) })
		do(t, r, "GET", "/ctx", map[string]string{"X-Request-Id": "ctx-1"})
		if seen != "ctx-1" {
			t.Fatalf("got %q", seen)
		}
	})
}

func TestHealth(t *testing.T) {
	r := NewRouter(Config{Name: "payments", Version: "1.2.3", Logger: quietLogger()})
	rec := do(t, r, "GET", "/health", nil)
	body := decode(t, rec)
	if rec.Code != 200 || body["status"] != "ok" || body["name"] != "payments" || body["version"] != "1.2.3" {
		t.Fatalf("got %d %v", rec.Code, body)
	}
	if _, ok := body["uptimeSeconds"]; !ok {
		t.Fatal("uptimeSeconds missing")
	}
}

func okCheck(context.Context) error { return nil }

func failCheck(context.Context) error { return errors.New("down") }

func TestReady(t *testing.T) {
	cases := []struct {
		name   string
		checks []Check
		code   int
		status string
	}{
		{"no checks", nil, 200, "ready"},
		{"all ok", []Check{{"db", true, okCheck}}, 200, "ready"},
		{"optional failing is degraded", []Check{{"db", true, okCheck}, {"vendor", false, failCheck}}, 200, "degraded"},
		{"required failing is 503", []Check{{"db", true, failCheck}, {"vendor", false, okCheck}}, 503, "unavailable"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := NewRouter(Config{Name: "t", Logger: quietLogger(), Checks: c.checks})
			rec := do(t, r, "GET", "/ready", nil)
			if rec.Code != c.code || decode(t, rec)["status"] != c.status {
				t.Fatalf("got %d %s", rec.Code, rec.Body.String())
			}
			if strings.Contains(rec.Body.String(), "down") {
				t.Fatal("check error text leaked")
			}
		})
	}
}

func TestReadyCheckTimesOut(t *testing.T) {
	slow := func(ctx context.Context) error {
		<-ctx.Done()
		return ctx.Err()
	}
	r := NewRouter(Config{Name: "t", Logger: quietLogger(), Checks: []Check{{"slow", true, slow}}})
	start := time.Now()
	rec := do(t, r, "GET", "/ready", nil)
	if rec.Code != 503 || time.Since(start) > 4*time.Second {
		t.Fatalf("got %d after %s", rec.Code, time.Since(start))
	}
}

func signed(t *testing.T, secret string, mutate func(*ServiceClaims)) string {
	t.Helper()
	claims := ServiceClaims{
		SchoolID: "school-1",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    testIssuer,
			Audience:  jwt.ClaimStrings{testAudience},
			Subject:   "user-1",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	}
	if mutate != nil {
		mutate(&claims)
	}
	tok, err := SignServiceToken(secret, claims)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestServiceToken(t *testing.T) {
	v, err := NewServiceTokenVerifier(testSecret, testIssuer, testAudience)
	if err != nil {
		t.Fatal(err)
	}
	r := NewRouter(Config{Name: "t", Logger: quietLogger()})
	var got *ServiceClaims
	r.With(RequireServiceToken(v)).Get("/secure", func(w http.ResponseWriter, r *http.Request) {
		got, _ = ClaimsFrom(r.Context())
	})
	call := func(auth string) *httptest.ResponseRecorder {
		h := map[string]string{}
		if auth != "" {
			h["Authorization"] = auth
		}
		return do(t, r, "GET", "/secure", h)
	}

	t.Run("valid", func(t *testing.T) {
		rec := call("Bearer " + signed(t, testSecret, nil))
		if rec.Code != 200 || got == nil || got.SchoolID != "school-1" || got.Subject != "user-1" {
			t.Fatalf("got %d %+v", rec.Code, got)
		}
	})
	t.Run("expired", func(t *testing.T) {
		tok := signed(t, testSecret, func(c *ServiceClaims) { c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute)) })
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("no expiry", func(t *testing.T) {
		tok := signed(t, testSecret, func(c *ServiceClaims) { c.ExpiresAt = nil })
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("wrong audience", func(t *testing.T) {
		tok := signed(t, testSecret, func(c *ServiceClaims) { c.Audience = jwt.ClaimStrings{"identity"} })
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("wrong issuer", func(t *testing.T) {
		tok := signed(t, testSecret, func(c *ServiceClaims) { c.Issuer = "attacker" })
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("wrong secret", func(t *testing.T) {
		if rec := call("Bearer " + signed(t, "another-secret-another-secret-12", nil)); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("missing school", func(t *testing.T) {
		tok := signed(t, testSecret, func(c *ServiceClaims) { c.SchoolID = "" })
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("alg none is rejected", func(t *testing.T) {
		tok, _ := jwt.NewWithClaims(jwt.SigningMethodNone, ServiceClaims{SchoolID: "s", RegisteredClaims: jwt.RegisteredClaims{
			Issuer: testIssuer, Audience: jwt.ClaimStrings{testAudience}, Subject: "u",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		}}).SignedString(jwt.UnsafeAllowNoneSignatureType)
		if rec := call("Bearer " + tok); rec.Code != 401 {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("missing header", func(t *testing.T) {
		rec := call("")
		if rec.Code != 401 || decode(t, rec)["code"] != "AUTH_UNAUTHORIZED" {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
}

func TestServiceTokenRefusesMissingSecret(t *testing.T) {
	if _, err := NewServiceTokenVerifier("", testIssuer, testAudience); err == nil {
		t.Fatal("expected error for empty secret")
	}
	t.Setenv(serviceTokenSecretEnv, "")
	if _, err := NewServiceTokenVerifierFromEnv(testIssuer, testAudience); err == nil {
		t.Fatal("expected error when env is unset")
	}
	t.Setenv(serviceTokenSecretEnv, testSecret)
	if _, err := NewServiceTokenVerifierFromEnv(testIssuer, testAudience); err != nil {
		t.Fatalf("unexpected: %v", err)
	}
}

type fakeTx struct {
	pgx.Tx
	execSQL   string
	execArgs  []any
	execErr   error
	committed bool
	rolled    bool
}

func (f *fakeTx) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.execSQL, f.execArgs = sql, args
	return pgconn.CommandTag{}, f.execErr
}
func (f *fakeTx) Commit(context.Context) error   { f.committed = true; return nil }
func (f *fakeTx) Rollback(context.Context) error { f.rolled = true; return nil }

type fakePool struct{ tx *fakeTx }

func (p fakePool) Begin(context.Context) (pgx.Tx, error) { return p.tx, nil }

func TestWithSchool(t *testing.T) {
	t.Run("sets app.school_id before fn and commits", func(t *testing.T) {
		tx := &fakeTx{}
		err := WithSchool(context.Background(), fakePool{tx}, "school-9", func(context.Context, pgx.Tx) error {
			if !strings.Contains(tx.execSQL, "set_config('app.school_id', $1, true)") || tx.execArgs[0] != "school-9" {
				t.Fatalf("setting not applied before fn: %q %v", tx.execSQL, tx.execArgs)
			}
			return nil
		})
		if err != nil || !tx.committed {
			t.Fatalf("err=%v committed=%v", err, tx.committed)
		}
	})
	t.Run("fn error rolls back without commit", func(t *testing.T) {
		tx := &fakeTx{}
		boom := errors.New("boom")
		err := WithSchool(context.Background(), fakePool{tx}, "s", func(context.Context, pgx.Tx) error { return boom })
		if !errors.Is(err, boom) || tx.committed || !tx.rolled {
			t.Fatalf("err=%v committed=%v rolled=%v", err, tx.committed, tx.rolled)
		}
	})
	t.Run("set_config failure never runs fn", func(t *testing.T) {
		tx := &fakeTx{execErr: errors.New("db down")}
		ran := false
		err := WithSchool(context.Background(), fakePool{tx}, "s", func(context.Context, pgx.Tx) error { ran = true; return nil })
		if err == nil || ran || tx.committed {
			t.Fatalf("err=%v ran=%v committed=%v", err, ran, tx.committed)
		}
	})
	t.Run("empty school id is a validation error", func(t *testing.T) {
		err := WithSchool(context.Background(), fakePool{&fakeTx{}}, "", func(context.Context, pgx.Tx) error { return nil })
		var appErr *AppError
		if !errors.As(err, &appErr) || appErr.Status != 400 {
			t.Fatalf("got %v", err)
		}
	})
}
