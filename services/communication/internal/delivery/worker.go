package delivery

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	_ "time/tzdata" // embeds the zone database so Africa/Nairobi loads on any host

	"github.com/stackable/communication/internal/notifications"
)

const claimLease = 2 * time.Minute // a crashed worker's claim expires after this

// WorkerConfig tunes the delivery loop.
type WorkerConfig struct {
	Interval time.Duration
	Batch    int
	Location *time.Location
	Now      func() time.Time
}

// Worker turns QUEUED deliveries into sends.
type Worker struct {
	store    notifications.Store
	adapters map[string]ChannelAdapter
	cfg      WorkerConfig
	logger   *slog.Logger
}

// NewWorker fills config defaults: 5s interval, 50 per batch, UTC, real clock.
func NewWorker(store notifications.Store, adapters map[string]ChannelAdapter, cfg WorkerConfig, logger *slog.Logger) *Worker {
	if cfg.Interval <= 0 {
		cfg.Interval = 5 * time.Second
	}
	if cfg.Batch <= 0 {
		cfg.Batch = 50
	}
	if cfg.Location == nil {
		cfg.Location = time.UTC
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Worker{store: store, adapters: adapters, cfg: cfg, logger: logger}
}

// Run ticks until ctx is cancelled.
func (w *Worker) Run(ctx context.Context) {
	t := time.NewTicker(w.cfg.Interval)
	defer t.Stop()
	for {
		if _, err := w.RunOnce(ctx); err != nil && ctx.Err() == nil {
			w.logger.Error("delivery tick failed", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// RunOnce claims one batch and processes it; it returns how many deliveries were claimed.
func (w *Worker) RunOnce(ctx context.Context) (int, error) {
	jobs, err := w.store.ClaimQueued(ctx, w.cfg.Batch, claimLease)
	if err != nil {
		return 0, err
	}
	for _, job := range jobs {
		if err := w.process(ctx, job); err != nil {
			w.logger.Error("process delivery", "deliveryId", job.DeliveryID, "err", err)
		}
	}
	return len(jobs), nil
}

// buildChain returns the channels to try, in fallback order, after the recipient and preference filters.
func buildChain(job notifications.Job, pref *notifications.Preference) []string {
	var chain []string
	for _, c := range notifications.ChannelOrder {
		if contains(job.ChannelsAllowed, c) && (pref == nil || contains(pref.Channels, c)) {
			chain = append(chain, c)
		}
	}
	return chain
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// inQuietHours handles ranges that wrap midnight, such as 22:00 to 06:00.
func inQuietHours(pref *notifications.Preference, now time.Time) bool {
	if pref == nil || pref.QuietStart == nil || pref.QuietEnd == nil {
		return false
	}
	start, end, cur := minutes(*pref.QuietStart), minutes(*pref.QuietEnd), now.Hour()*60+now.Minute()
	if start == end {
		return false
	}
	if start < end {
		return cur >= start && cur < end
	}
	return cur >= start || cur < end
}

func minutes(hhmm string) int {
	var h, m int
	_, _ = fmt.Sscanf(hhmm, "%d:%d", &h, &m) // values were validated as HH:MM when saved
	return h*60 + m
}

func (w *Worker) process(ctx context.Context, job notifications.Job) error {
	pref, err := w.store.FindPreference(ctx, job.SchoolID, job.UserID, job.Type)
	if err != nil {
		_ = w.store.ReleaseDelivery(ctx, job.SchoolID, job.DeliveryID)
		return fmt.Errorf("find preference: %w", err)
	}
	chain := buildChain(job, pref)
	quiet := inQuietHours(pref, w.cfg.Now().In(w.cfg.Location))
	if len(chain) > 0 && quiet && !job.Urgent && job.Type != notifications.TypeSafety {
		return w.store.ReleaseDelivery(ctx, job.SchoolID, job.DeliveryID) // retried on a later tick once quiet hours end
	}

	attempt, lastChannel, lastErr := job.Attempt, "", "no channel allowed"
	for _, ch := range chain {
		adapter, ok := w.adapters[ch]
		if !ok {
			adapter = DisabledAdapter{}
		}
		attempt++
		ref, err := adapter.Send(ctx, Message{
			SchoolID: job.SchoolID, DeliveryID: job.DeliveryID, NotificationID: job.NotificationID, UserID: job.UserID,
			Channel: ch, Type: job.Type, Title: job.Title, Body: job.Body, ChildIDs: job.ChildIDs, Email: job.Email, Phone: job.Phone,
		})
		if err == nil {
			return w.store.FinishDelivery(ctx, job.SchoolID, job.DeliveryID,
				notifications.Result{Status: notifications.StatusSent, Channel: ch, Attempt: attempt, ProviderRef: ref})
		}
		if ctx.Err() != nil {
			return w.store.ReleaseDelivery(context.WithoutCancel(ctx), job.SchoolID, job.DeliveryID) // shutdown is not a failed send
		}
		w.logger.Warn("channel failed", "deliveryId", job.DeliveryID, "channel", ch, "err", err)
		lastChannel, lastErr = ch, err.Error()
	}
	return w.store.FinishDelivery(ctx, job.SchoolID, job.DeliveryID,
		notifications.Result{Status: notifications.StatusUndelivered, Channel: lastChannel, Attempt: attempt, Error: lastErr})
}
