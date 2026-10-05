package webhooks

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	kit "github.com/stackable/go-kit"
)

func newTestServer(store Store) http.Handler {
	r := kit.NewRouter(kit.Config{Name: "payments", Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))})
	NewHandler(NewService(store)).Routes(r)
	return r
}

func post(h http.Handler, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestWebhookIsStoredOnce(t *testing.T) {
	store := NewMemoryStore()
	h := newTestServer(store)
	body := `{"id":"evt_1","amount":5000}`

	first := post(h, "/v1/webhooks/fake", body)
	second := post(h, "/v1/webhooks/fake", body)

	if first.Code != 200 || second.Code != 200 {
		t.Fatalf("statuses %d %d", first.Code, second.Code)
	}
	var a, b map[string]any
	_ = json.Unmarshal(first.Body.Bytes(), &a)
	_ = json.Unmarshal(second.Body.Bytes(), &b)
	if a["duplicate"] != false || b["duplicate"] != true {
		t.Fatalf("duplicate flags: %v %v", a, b)
	}
	if store.Count() != 1 {
		t.Fatalf("store holds %d rows, want 1", store.Count())
	}
}

func TestSameEventIDFromDifferentProvidersAreSeparate(t *testing.T) {
	store := NewMemoryStore()
	h := newTestServer(store)
	post(h, "/v1/webhooks/fake", `{"id":"1"}`)
	post(h, "/v1/webhooks/paystack", `{"data":{"id":1}}`)
	if store.Count() != 2 {
		t.Fatalf("store holds %d rows, want 2", store.Count())
	}
}

func TestMpesaEventIDIsCheckoutRequestID(t *testing.T) {
	store := NewMemoryStore()
	h := newTestServer(store)
	body := `{"Body":{"stkCallback":{"CheckoutRequestID":"ws_CO_1","ResultCode":0}}}`
	post(h, "/v1/webhooks/mpesa", body)
	if rec := post(h, "/v1/webhooks/mpesa", body); rec.Code != 200 || store.Count() != 1 {
		t.Fatalf("got %d, rows %d", rec.Code, store.Count())
	}
}

func TestBadWebhooksUseErrorEnvelope(t *testing.T) {
	cases := []struct {
		name, path, body, code string
		status                 int
	}{
		{"unknown provider", "/v1/webhooks/nope", `{"id":"1"}`, "RESOURCE_NOT_FOUND", 404},
		{"not json", "/v1/webhooks/fake", `not json`, "VALIDATION_FAILED", 400},
		{"not an object", "/v1/webhooks/fake", `[1,2]`, "VALIDATION_FAILED", 400},
		{"missing event id", "/v1/webhooks/fake", `{"amount":1}`, "VALIDATION_FAILED", 400},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			store := NewMemoryStore()
			rec := post(newTestServer(store), c.path, c.body)
			var body map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &body)
			if rec.Code != c.status || body["code"] != c.code || store.Count() != 0 {
				t.Fatalf("got %d %v rows=%d", rec.Code, body, store.Count())
			}
		})
	}
}
