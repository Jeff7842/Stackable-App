package notifications

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	kit "github.com/stackable/go-kit"
)

const (
	testSecret = "test-secret"
	schoolA    = "11111111-1111-4111-8111-111111111111"
	schoolB    = "22222222-2222-4222-8222-222222222222"
	parent1    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	parent2    = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	child1     = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
	child2     = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
)

func newServer(t *testing.T, store Store, verifier SignatureVerifier) http.Handler {
	t.Helper()
	tokens, err := kit.NewServiceTokenVerifier(testSecret, "stackable-gateway", "communication")
	if err != nil {
		t.Fatal(err)
	}
	r := kit.NewRouter(kit.Config{Name: "communication", Logger: slog.New(slog.NewJSONHandler(io.Discard, nil))})
	NewHandler(NewService(store), verifier).Routes(r, tokens)
	return r
}

func token(t *testing.T, school, user string) string {
	t.Helper()
	tok, err := kit.SignServiceToken(testSecret, kit.ServiceClaims{SchoolID: school, RegisteredClaims: jwt.RegisteredClaims{
		Issuer: "stackable-gateway", Audience: jwt.ClaimStrings{"communication"}, Subject: user,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	}})
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func call(h http.Handler, method, path, tok, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("bad json %q: %v", rec.Body.String(), err)
	}
	return out
}

func createBody(key string, recipients string) string {
	return `{"type":"fees","title":"Fee due","body":"Please pay","urgent":false,"idempotencyKey":"` + key + `","recipients":` + recipients + `}`
}

func TestCreateIsIdempotentPerKey(t *testing.T) {
	store := NewMemoryStore()
	h := newServer(t, store, FakeVerifier{})
	tok := token(t, schoolA, parent1)
	body := createBody("k1", `[{"userId":"`+parent1+`","childIds":["`+child1+`"]}]`)

	first := call(h, "POST", "/v1/notifications", tok, body)
	second := call(h, "POST", "/v1/notifications", tok, body)

	if first.Code != 201 || second.Code != 200 {
		t.Fatalf("statuses %d %d", first.Code, second.Code)
	}
	if decode(t, first)["id"] != decode(t, second)["id"] {
		t.Fatal("repeat must return the original notification")
	}
	id := decode(t, first)["id"].(string)
	if n := len(store.Deliveries(schoolA, id)); n != 1 {
		t.Fatalf("repeat created extra deliveries: %d", n)
	}
}

func TestSameKeyInAnotherSchoolIsSeparate(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	body := createBody("k1", `[{"userId":"`+parent1+`"}]`)
	a := call(h, "POST", "/v1/notifications", token(t, schoolA, parent1), body)
	b := call(h, "POST", "/v1/notifications", token(t, schoolB, parent1), body)
	if a.Code != 201 || b.Code != 201 {
		t.Fatalf("statuses %d %d", a.Code, b.Code)
	}
}

func TestDedupeOneMessagePerParentWithAllChildren(t *testing.T) {
	store := NewMemoryStore()
	h := newServer(t, store, FakeVerifier{})
	tok := token(t, schoolA, parent1)
	rec := call(h, "POST", "/v1/notifications", tok, createBody("k1", `[
	  {"userId":"`+parent1+`","childIds":["`+child1+`"],"channelsAllowed":["push"]},
	  {"userId":"`+parent1+`","childIds":["`+child2+`","`+child1+`"],"channelsAllowed":["sms"]},
	  {"userId":"`+parent2+`","childIds":["`+child1+`"]}]`))
	if rec.Code != 201 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	id := decode(t, rec)["id"].(string)
	if n := len(store.Deliveries(schoolA, id)); n != 2 {
		t.Fatalf("want 2 deliveries (one per parent), got %d", n)
	}

	inbox := decode(t, call(h, "GET", "/v1/inbox", tok, ""))["items"].([]any)
	if len(inbox) != 1 {
		t.Fatalf("parent1 inbox has %d items", len(inbox))
	}
	kids := inbox[0].(map[string]any)["childIds"].([]any)
	if len(kids) != 2 || kids[0] != child1 || kids[1] != child2 {
		t.Fatalf("combined child ids wrong: %v", kids)
	}
}

func TestValidationListsFailedFields(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	rec := call(h, "POST", "/v1/notifications", token(t, schoolA, parent1), `{"type":"","recipients":[{"userId":"nope"}]}`)
	if rec.Code != 400 {
		t.Fatalf("status %d", rec.Code)
	}
	details := decode(t, rec)["details"].(map[string]any)
	for _, f := range []string{"type", "title", "body", "idempotencyKey", "recipients[0].userId"} {
		if _, ok := details[f]; !ok {
			t.Errorf("missing failed field %s in %v", f, details)
		}
	}
}

func TestServiceTokenRequired(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	if rec := call(h, "GET", "/v1/inbox", "", ""); rec.Code != 401 {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestInboxTenantIsolation(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	rec := call(h, "POST", "/v1/notifications", token(t, schoolA, parent1), createBody("k1", `[{"userId":"`+parent1+`"}]`))
	id := decode(t, rec)["id"].(string)

	// same user id, other school: must see nothing and must not be able to read or count it
	other := token(t, schoolB, parent1)
	if items := decode(t, call(h, "GET", "/v1/inbox", other, ""))["items"].([]any); len(items) != 0 {
		t.Fatalf("school B sees school A inbox: %v", items)
	}
	if rec := call(h, "POST", "/v1/inbox/"+id+"/read", other, ""); rec.Code != 404 {
		t.Fatalf("cross-school read status %d", rec.Code)
	}
	if rec := call(h, "GET", "/v1/notifications/"+id+"/deliveries", other, ""); rec.Code != 404 {
		t.Fatalf("cross-school deliveries status %d", rec.Code)
	}
}

func TestInboxPaginationAndRead(t *testing.T) {
	clock := time.Date(2026, 1, 1, 8, 0, 0, 0, time.UTC)
	store := NewMemoryStoreWithClock(func() time.Time { clock = clock.Add(time.Minute); return clock })
	h := newServer(t, store, FakeVerifier{})
	tok := token(t, schoolA, parent1)
	for _, k := range []string{"a", "b", "c"} {
		call(h, "POST", "/v1/notifications", tok, createBody(k, `[{"userId":"`+parent1+`"}]`))
	}

	page1 := decode(t, call(h, "GET", "/v1/inbox?limit=2", tok, ""))
	if len(page1["items"].([]any)) != 2 || page1["nextCursor"] == nil {
		t.Fatalf("page1 %v", page1)
	}
	page2 := decode(t, call(h, "GET", "/v1/inbox?limit=2&cursor="+page1["nextCursor"].(string), tok, ""))
	if len(page2["items"].([]any)) != 1 || page2["nextCursor"] != nil {
		t.Fatalf("page2 %v", page2)
	}

	id := page1["items"].([]any)[0].(map[string]any)["id"].(string)
	if rec := call(h, "POST", "/v1/inbox/"+id+"/read", tok, ""); rec.Code != 200 {
		t.Fatalf("read status %d", rec.Code)
	}
	first := decode(t, call(h, "GET", "/v1/inbox?limit=1", tok, ""))["items"].([]any)[0].(map[string]any)
	if first["readAt"] == nil {
		t.Fatal("readAt not set")
	}
	if rec := call(h, "GET", "/v1/inbox?cursor=garbage", tok, ""); rec.Code != 400 {
		t.Fatalf("bad cursor status %d", rec.Code)
	}
}

func TestPreferencesRoundTripAndValidation(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	tok := token(t, schoolA, parent1)
	put := call(h, "PUT", "/v1/preferences", tok, `{"preferences":[{"type":"*","channels":["email","push"],"quietStart":"22:00","quietEnd":"06:00"}]}`)
	if put.Code != 200 {
		t.Fatalf("status %d: %s", put.Code, put.Body.String())
	}
	prefs := decode(t, call(h, "GET", "/v1/preferences", tok, ""))["preferences"].([]any)
	if len(prefs) != 1 || prefs[0].(map[string]any)["channels"].([]any)[0] != "push" {
		t.Fatalf("prefs %v", prefs)
	}
	bad := call(h, "PUT", "/v1/preferences", tok, `{"preferences":[{"type":"x","channels":["fax"],"quietStart":"25:00"}]}`)
	if bad.Code != 400 {
		t.Fatalf("bad prefs status %d", bad.Code)
	}
	other := decode(t, call(h, "GET", "/v1/preferences", token(t, schoolB, parent1), ""))["preferences"].([]any)
	if len(other) != 0 {
		t.Fatal("preferences leaked across schools")
	}
}

func TestDeliveryCountsIncludeEveryStatus(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{})
	tok := token(t, schoolA, parent1)
	id := decode(t, call(h, "POST", "/v1/notifications", tok, createBody("k", `[{"userId":"`+parent1+`"},{"userId":"`+parent2+`"}]`)))["id"].(string)
	counts := decode(t, call(h, "GET", "/v1/notifications/"+id+"/deliveries", tok, ""))["counts"].(map[string]any)
	if counts["QUEUED"] != float64(2) || counts["SENT"] != float64(0) || len(counts) != 5 {
		t.Fatalf("counts %v", counts)
	}
}

func TestCallbackIsIdempotentAndUpdatesDelivery(t *testing.T) {
	store := NewMemoryStore()
	h := newServer(t, store, FakeVerifier{})
	tok := token(t, schoolA, parent1)
	id := decode(t, call(h, "POST", "/v1/notifications", tok, createBody("k", `[{"userId":"`+parent1+`"}]`)))["id"].(string)
	d := store.Deliveries(schoolA, id)[0]
	if err := store.FinishDelivery(context.Background(), schoolA, d.ID, Result{Status: StatusSent, Channel: ChannelEmail, Attempt: 1, ProviderRef: "ref-1"}); err != nil {
		t.Fatal(err)
	}

	body := `{"id":"evt-1","providerRef":"ref-1","status":"DELIVERED"}`
	first := decode(t, call(h, "POST", "/v1/callbacks/fake", "", body))
	second := decode(t, call(h, "POST", "/v1/callbacks/fake", "", body))
	if first["duplicate"] != false || second["duplicate"] != true || first["matched"] != true {
		t.Fatalf("flags %v %v", first, second)
	}
	counts, _ := store.DeliveryCounts(context.Background(), schoolA, id)
	if counts[StatusDelivered] != 1 {
		t.Fatalf("counts %v", counts)
	}
	unknown := decode(t, call(h, "POST", "/v1/callbacks/fake", "", `{"id":"e2","providerRef":"nope","status":"DELIVERED"}`))
	if unknown["matched"] != false {
		t.Fatalf("unknown ref should not match: %v", unknown)
	}
}

func TestCallbackRejectedSignature(t *testing.T) {
	h := newServer(t, NewMemoryStore(), FakeVerifier{Reject: true})
	if rec := call(h, "POST", "/v1/callbacks/fake", "", `{"id":"e","providerRef":"r","status":"DELIVERED"}`); rec.Code != 401 {
		t.Fatalf("status %d", rec.Code)
	}
	ok := newServer(t, NewMemoryStore(), FakeVerifier{})
	if rec := call(ok, "POST", "/v1/callbacks/unknown", "", `{}`); rec.Code != 404 {
		t.Fatalf("unknown provider status %d", rec.Code)
	}
}
