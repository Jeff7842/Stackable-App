package notifications

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"
	"time"
)

type recipientRow struct {
	Recipient
	schoolID string
	readAt   *time.Time
}

// DeliveryRow is one delivery as the memory store holds it.
type DeliveryRow struct {
	ID             string
	SchoolID       string
	NotificationID string
	UserID         string
	Channel        string
	Status         string
	Attempt        int
	ProviderRef    string
	Error          string
	claimedAt      time.Time
}

// OutboxRow is one event waiting to be published.
type OutboxRow struct {
	SchoolID string
	Topic    string
	Payload  []byte
}

type notificationRow struct {
	Notification
	schoolID string
}

// MemoryStore is an in-process Store for tests and local runs without a database.
type MemoryStore struct {
	mu         sync.Mutex
	now        func() time.Time
	notifs     map[string]*notificationRow
	byKey      map[string]string
	recipients map[string][]*recipientRow
	deliveries []*DeliveryRow
	prefs      map[string]Preference
	callbacks  map[string]bool
	outbox     []OutboxRow
}

// NewMemoryStore returns an empty MemoryStore using the real clock.
func NewMemoryStore() *MemoryStore { return NewMemoryStoreWithClock(time.Now) }

// NewMemoryStoreWithClock lets tests control created_at and claim leases.
func NewMemoryStoreWithClock(now func() time.Time) *MemoryStore {
	return &MemoryStore{
		now:        now,
		notifs:     map[string]*notificationRow{},
		byKey:      map[string]string{},
		recipients: map[string][]*recipientRow{},
		prefs:      map[string]Preference{},
		callbacks:  map[string]bool{},
	}
}

// key joins parts with a NUL so ("a","bc") and ("ab","c") never collide.
func key(parts ...string) string {
	return strings.Join(parts, "\x00")
}

// CreateNotification stores the notification once per (school, idempotency key).
func (m *MemoryStore) CreateNotification(_ context.Context, n NewNotification) (Notification, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id, ok := m.byKey[key(n.SchoolID, n.IdempotencyKey)]; ok {
		return m.notifs[id].Notification, false, nil
	}
	n.CreatedAt = m.now()
	m.notifs[n.ID] = &notificationRow{Notification: n.Notification, schoolID: n.SchoolID}
	m.byKey[key(n.SchoolID, n.IdempotencyKey)] = n.ID
	for _, r := range n.Recipients {
		m.recipients[n.ID] = append(m.recipients[n.ID], &recipientRow{Recipient: r, schoolID: n.SchoolID})
		m.deliveries = append(m.deliveries, &DeliveryRow{
			ID: NewID(), SchoolID: n.SchoolID, NotificationID: n.ID, UserID: r.UserID,
			Channel: ChannelPush, Status: StatusQueued,
		})
	}
	return n.Notification, true, nil
}

// ListInbox returns the user's notifications newest first, keyset-paginated.
func (m *MemoryStore) ListInbox(_ context.Context, schoolID, userID string, limit int, after *Cursor) ([]InboxItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var items []InboxItem
	for id, rows := range m.recipients {
		n := m.notifs[id]
		if n.schoolID != schoolID {
			continue
		}
		for _, r := range rows {
			if r.schoolID != schoolID || r.UserID != userID {
				continue
			}
			items = append(items, InboxItem{ID: id, Type: n.Type, Title: n.Title, Body: n.Body, Urgent: n.Urgent,
				ChildIDs: append([]string{}, r.ChildIDs...), CreatedAt: n.CreatedAt, ReadAt: r.readAt})
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if !items[i].CreatedAt.Equal(items[j].CreatedAt) {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		}
		return items[i].ID > items[j].ID
	})
	out := []InboxItem{}
	for _, it := range items {
		if after != nil && !isBefore(it, *after) {
			continue
		}
		if len(out) == limit {
			break
		}
		out = append(out, it)
	}
	return out, nil
}

func isBefore(it InboxItem, c Cursor) bool {
	return it.CreatedAt.Before(c.CreatedAt) || (it.CreatedAt.Equal(c.CreatedAt) && it.ID < c.ID)
}

// MarkRead sets read_at once and keeps the first read time on repeats.
func (m *MemoryStore) MarkRead(_ context.Context, schoolID, userID, notificationID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.recipients[notificationID] {
		if r.schoolID == schoolID && r.UserID == userID {
			if r.readAt == nil {
				t := m.now()
				r.readAt = &t
			}
			return nil
		}
	}
	return ErrNotFound
}

// ListPreferences returns the user's preference rows sorted by type.
func (m *MemoryStore) ListPreferences(_ context.Context, schoolID, userID string) ([]Preference, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	prefix := key(schoolID, userID) + "\x00"
	out := []Preference{}
	for k, p := range m.prefs {
		if strings.HasPrefix(k, prefix) {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Type < out[j].Type })
	return out, nil
}

// FindPreference prefers the exact type and falls back to the AnyType row.
func (m *MemoryStore) FindPreference(_ context.Context, schoolID, userID, notifType string) (*Preference, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, t := range []string{notifType, AnyType} {
		if p, ok := m.prefs[key(schoolID, userID, t)]; ok {
			return &p, nil
		}
	}
	return nil, nil
}

// SavePreferences upserts each given type.
func (m *MemoryStore) SavePreferences(_ context.Context, schoolID, userID string, prefs []Preference) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, p := range prefs {
		m.prefs[key(schoolID, userID, p.Type)] = p
	}
	return nil
}

// DeliveryCounts counts deliveries per status for one notification.
func (m *MemoryStore) DeliveryCounts(_ context.Context, schoolID, notificationID string) (map[string]int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if n, ok := m.notifs[notificationID]; !ok || n.schoolID != schoolID {
		return nil, ErrNotFound
	}
	counts := map[string]int{}
	for _, s := range AllStatuses {
		counts[s] = 0
	}
	for _, d := range m.deliveries {
		if d.NotificationID == notificationID && d.SchoolID == schoolID {
			counts[d.Status]++
		}
	}
	return counts, nil
}

// ClaimQueued leases QUEUED deliveries whose claim is missing or older than lease.
func (m *MemoryStore) ClaimQueued(_ context.Context, limit int, lease time.Duration) ([]Job, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	var jobs []Job
	for _, d := range m.deliveries {
		if len(jobs) == limit {
			break
		}
		if d.Status != StatusQueued || (!d.claimedAt.IsZero() && now.Sub(d.claimedAt) < lease) {
			continue
		}
		d.claimedAt = now
		n := m.notifs[d.NotificationID]
		job := Job{DeliveryID: d.ID, SchoolID: d.SchoolID, NotificationID: d.NotificationID, UserID: d.UserID,
			Attempt: d.Attempt, Type: n.Type, Title: n.Title, Body: n.Body, Urgent: n.Urgent}
		for _, r := range m.recipients[d.NotificationID] {
			if r.UserID == d.UserID {
				job.ChildIDs, job.ChannelsAllowed, job.Email, job.Phone = r.ChildIDs, r.ChannelsAllowed, r.Email, r.Phone
			}
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func (m *MemoryStore) findDelivery(schoolID, id string) *DeliveryRow {
	for _, d := range m.deliveries {
		if d.ID == id && d.SchoolID == schoolID {
			return d
		}
	}
	return nil
}

// ReleaseDelivery clears the claim so the next tick can pick the delivery up again.
func (m *MemoryStore) ReleaseDelivery(_ context.Context, schoolID, deliveryID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	d := m.findDelivery(schoolID, deliveryID)
	if d == nil {
		return ErrNotFound
	}
	d.claimedAt = time.Time{}
	return nil
}

// FinishDelivery records the result and the outbox row for UNDELIVERED.
func (m *MemoryStore) FinishDelivery(_ context.Context, schoolID, deliveryID string, res Result) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	d := m.findDelivery(schoolID, deliveryID)
	if d == nil {
		return ErrNotFound
	}
	d.Status, d.Attempt, d.ProviderRef, d.Error, d.claimedAt = res.Status, res.Attempt, res.ProviderRef, res.Error, time.Time{}
	if res.Channel != "" {
		d.Channel = res.Channel
	}
	if res.Status == StatusUndelivered {
		payload, err := json.Marshal(map[string]string{"notificationId": d.NotificationID, "userId": d.UserID, "deliveryId": d.ID})
		if err != nil {
			return err
		}
		m.outbox = append(m.outbox, OutboxRow{SchoolID: schoolID, Topic: OutboxTopicUndelivered, Payload: payload})
	}
	return nil
}

// RecordCallback is idempotent per (provider, event id) and ignores reports for unknown provider refs.
func (m *MemoryStore) RecordCallback(_ context.Context, ev CallbackEvent) (CallbackOutcome, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var target *DeliveryRow
	for _, d := range m.deliveries {
		if d.ProviderRef != "" && d.ProviderRef == ev.ProviderRef {
			target = d
		}
	}
	if target == nil {
		return CallbackOutcome{}, nil
	}
	k := key(ev.Provider, ev.EventID)
	if m.callbacks[k] {
		return CallbackOutcome{Matched: true, Duplicate: true}, nil
	}
	m.callbacks[k] = true
	if canApplyCallback(target.Status) {
		target.Status = ev.Status
	}
	return CallbackOutcome{Matched: true}, nil
}

// Deliveries returns copies of a notification's deliveries for tests.
func (m *MemoryStore) Deliveries(schoolID, notificationID string) []DeliveryRow {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []DeliveryRow
	for _, d := range m.deliveries {
		if d.SchoolID == schoolID && d.NotificationID == notificationID {
			out = append(out, *d)
		}
	}
	return out
}

// Outbox returns copies of the outbox rows for tests.
func (m *MemoryStore) Outbox() []OutboxRow {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]OutboxRow{}, m.outbox...)
}
