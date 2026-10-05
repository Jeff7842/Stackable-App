package delivery

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stackable/communication/internal/notifications"
)

const (
	school = "11111111-1111-4111-8111-111111111111"
	user   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
)

type rig struct {
	store    *notifications.MemoryStore
	adapters map[string]*FakeAdapter
	worker   *Worker
	now      time.Time
}

// newRig builds a worker over the memory store with one fake adapter per channel; clock is 12:00 UTC.
func newRig(t *testing.T) *rig {
	t.Helper()
	r := &rig{store: notifications.NewMemoryStore(), adapters: map[string]*FakeAdapter{}, now: time.Date(2026, 3, 2, 12, 0, 0, 0, time.UTC)}
	m := map[string]ChannelAdapter{}
	for _, c := range notifications.ChannelOrder {
		r.adapters[c] = NewFakeAdapter()
		m[c] = r.adapters[c]
	}
	r.worker = NewWorker(r.store, m, WorkerConfig{Now: func() time.Time { return r.now }}, slog.New(slog.NewJSONHandler(io.Discard, nil)))
	return r
}

func (r *rig) send(t *testing.T, notifType string, urgent bool, channels []string) string {
	t.Helper()
	id := notifications.NewID()
	_, _, err := r.store.CreateNotification(context.Background(), notifications.NewNotification{
		Notification: notifications.Notification{ID: id, Type: notifType, Title: "T", Body: "B", Urgent: urgent, IdempotencyKey: id},
		SchoolID:     school,
		Recipients:   []notifications.Recipient{{UserID: user, ChannelsAllowed: channels, Email: "p@example.com", Phone: "+254700000000"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (r *rig) tick(t *testing.T) {
	t.Helper()
	if _, err := r.worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func (r *rig) delivery(id string) notifications.DeliveryRow { return r.store.Deliveries(school, id)[0] }

var all = []string{"push", "sms", "email"}

func TestFirstChannelIsPush(t *testing.T) {
	r := newRig(t)
	id := r.send(t, "fees", false, all)
	r.tick(t)
	d := r.delivery(id)
	if d.Status != "SENT" || d.Channel != "push" || d.Attempt != 1 || len(r.adapters["sms"].Calls()) != 0 {
		t.Fatalf("%+v", d)
	}
}

func TestFallbackChainOrder(t *testing.T) {
	r := newRig(t)
	r.adapters["push"].FailWith(errors.New("no device"))
	r.adapters["sms"].FailWith(errors.New("no credit"))
	id := r.send(t, "fees", false, all)
	r.tick(t)
	d := r.delivery(id)
	if d.Status != "SENT" || d.Channel != "email" || d.Attempt != 3 {
		t.Fatalf("want SENT via email after 3 attempts, got %+v", d)
	}
	if len(r.adapters["push"].Calls()) != 1 || len(r.adapters["sms"].Calls()) != 1 || len(r.adapters["email"].Calls()) != 1 {
		t.Fatal("each channel must be tried exactly once, in order")
	}
}

func TestUndeliveredWritesOutbox(t *testing.T) {
	r := newRig(t)
	for _, a := range r.adapters {
		a.FailWith(errors.New("down"))
	}
	id := r.send(t, "fees", false, all)
	r.tick(t)
	d := r.delivery(id)
	if d.Status != "UNDELIVERED" || d.Attempt != 3 || d.Error != "down" {
		t.Fatalf("%+v", d)
	}
	out := r.store.Outbox()
	if len(out) != 1 || out[0].Topic != "delivery.undelivered" || out[0].SchoolID != school {
		t.Fatalf("outbox %+v", out)
	}
	r.tick(t)
	if len(r.store.Outbox()) != 1 {
		t.Fatal("a finished delivery must not be retried")
	}
}

func TestChannelsAllowedFilter(t *testing.T) {
	r := newRig(t)
	id := r.send(t, "fees", false, []string{"sms", "email"})
	r.tick(t)
	d := r.delivery(id)
	if d.Channel != "sms" || len(r.adapters["push"].Calls()) != 0 {
		t.Fatalf("%+v", d)
	}
}

func TestPreferencesFilterChannels(t *testing.T) {
	r := newRig(t)
	_ = r.store.SavePreferences(context.Background(), school, user, []notifications.Preference{{Type: "*", Channels: []string{"email"}}})
	id := r.send(t, "fees", false, all)
	r.tick(t)
	if d := r.delivery(id); d.Channel != "email" || d.Attempt != 1 || len(r.adapters["push"].Calls()) != 0 {
		t.Fatalf("%+v", d)
	}
}

func TestExactTypePreferenceBeatsWildcard(t *testing.T) {
	r := newRig(t)
	_ = r.store.SavePreferences(context.Background(), school, user, []notifications.Preference{
		{Type: "*", Channels: []string{"email"}}, {Type: "fees", Channels: []string{"sms"}}})
	id := r.send(t, "fees", false, all)
	r.tick(t)
	if d := r.delivery(id); d.Channel != "sms" {
		t.Fatalf("%+v", d)
	}
}

func TestNoAllowedChannelIsUndelivered(t *testing.T) {
	r := newRig(t)
	_ = r.store.SavePreferences(context.Background(), school, user, []notifications.Preference{{Type: "*", Channels: []string{"push"}}})
	id := r.send(t, "fees", false, []string{"email"})
	r.tick(t)
	if d := r.delivery(id); d.Status != "UNDELIVERED" || len(r.store.Outbox()) != 1 {
		t.Fatalf("%+v", d)
	}
}

func quiet(r *rig, hour int) {
	start, end := "22:00", "06:00"
	_ = r.store.SavePreferences(context.Background(), school, user, []notifications.Preference{{Type: "*", Channels: all, QuietStart: &start, QuietEnd: &end}})
	r.now = time.Date(2026, 3, 2, hour, 30, 0, 0, time.UTC)
}

func TestQuietHoursDeferThenSend(t *testing.T) {
	r := newRig(t)
	quiet(r, 23)
	id := r.send(t, "fees", false, all)
	r.tick(t)
	if d := r.delivery(id); d.Status != "QUEUED" || len(r.adapters["push"].Calls()) != 0 {
		t.Fatalf("must wait during quiet hours: %+v", d)
	}
	r.now = time.Date(2026, 3, 3, 7, 0, 0, 0, time.UTC)
	r.tick(t)
	if d := r.delivery(id); d.Status != "SENT" {
		t.Fatalf("must send after quiet hours: %+v", d)
	}
}

func TestQuietHoursWrapPastMidnight(t *testing.T) {
	r := newRig(t)
	quiet(r, 3)
	id := r.send(t, "fees", false, all)
	r.tick(t)
	if d := r.delivery(id); d.Status != "QUEUED" {
		t.Fatalf("03:30 is inside 22:00-06:00: %+v", d)
	}
}

func TestQuietHoursOverriddenByUrgentAndSafety(t *testing.T) {
	for name, tc := range map[string]struct {
		notifType string
		urgent    bool
	}{"urgent": {"fees", true}, "safety": {"safety", false}} {
		t.Run(name, func(t *testing.T) {
			r := newRig(t)
			quiet(r, 23)
			id := r.send(t, tc.notifType, tc.urgent, all)
			r.tick(t)
			if d := r.delivery(id); d.Status != "SENT" {
				t.Fatalf("%+v", d)
			}
		})
	}
}

func TestClaimPreventsDoubleSend(t *testing.T) {
	r := newRig(t)
	id := r.send(t, "fees", false, all)
	jobs, _ := r.store.ClaimQueued(context.Background(), 10, time.Minute)
	again, _ := r.store.ClaimQueued(context.Background(), 10, time.Minute)
	if len(jobs) != 1 || len(again) != 0 {
		t.Fatalf("claims %d %d", len(jobs), len(again))
	}
	_ = id
}

func TestRunStopsOnContextCancel(t *testing.T) {
	r := newRig(t)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { r.worker.Run(ctx); close(done) }()
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("worker did not stop")
	}
}

func TestResendAdapter(t *testing.T) {
	var gotAuth, gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		gotAuth, gotKey = req.Header.Get("Authorization"), req.Header.Get("Idempotency-Key")
		_, _ = w.Write([]byte(`{"id":"em_1"}`))
	}))
	defer srv.Close()
	a := &ResendAdapter{apiKey: "k", from: "a@b.c", baseURL: srv.URL, client: srv.Client()}
	ref, err := a.Send(context.Background(), Message{DeliveryID: "d1", Email: "p@x.com", Title: "t", Body: "b"})
	if err != nil || ref != "em_1" || gotAuth != "Bearer k" || gotKey != "d1" {
		t.Fatalf("ref=%q err=%v auth=%q key=%q", ref, err, gotAuth, gotKey)
	}
	if _, err := (&ResendAdapter{}).Send(context.Background(), Message{Email: "p@x.com"}); !errors.Is(err, ErrDisabled) {
		t.Fatalf("unset adapter must be disabled, got %v", err)
	}
	if _, err := a.Send(context.Background(), Message{}); !errors.Is(err, ErrNoAddress) {
		t.Fatalf("want ErrNoAddress, got %v", err)
	}
}

func TestAfricasTalkingAdapter(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_ = req.ParseForm()
		if req.Header.Get("apiKey") != "k" || req.Form.Get("to") != "+254700000000" {
			w.WriteHeader(400)
			return
		}
		_, _ = w.Write([]byte(`{"SMSMessageData":{"Recipients":[{"statusCode":101,"messageId":"AT_1","status":"Success"}]}}`))
	}))
	defer srv.Close()
	a := &AfricasTalkingAdapter{username: "u", apiKey: "k", baseURL: srv.URL, client: srv.Client()}
	ref, err := a.Send(context.Background(), Message{Phone: "+254700000000", Title: "t", Body: "b"})
	if err != nil || ref != "AT_1" {
		t.Fatalf("ref=%q err=%v", ref, err)
	}
	if _, err := (&AfricasTalkingAdapter{}).Send(context.Background(), Message{Phone: "1"}); !errors.Is(err, ErrDisabled) {
		t.Fatalf("got %v", err)
	}
}
