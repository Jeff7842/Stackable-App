package webhooks

import (
	"context"
	"encoding/json"
	"sync"
)

// Event is one provider webhook as received.
type Event struct {
	Provider        string
	ExternalEventID string
	Payload         json.RawMessage
}

// Store persists webhook events once per (provider, external_event_id).
type Store interface {
	// Insert returns true when the event is new and false when it was already stored.
	Insert(ctx context.Context, ev Event) (bool, error)
}

// MemoryStore is an in-process Store for tests and local runs without a database.
type MemoryStore struct {
	mu     sync.Mutex
	events map[string]Event
}

// NewMemoryStore returns an empty MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{events: map[string]Event{}}
}

// Insert stores ev unless the same (provider, id) pair exists.
func (m *MemoryStore) Insert(_ context.Context, ev Event) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := ev.Provider + "\x00" + ev.ExternalEventID
	if _, exists := m.events[key]; exists {
		return false, nil
	}
	m.events[key] = ev
	return true, nil
}

// Count returns how many events are stored.
func (m *MemoryStore) Count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.events)
}
