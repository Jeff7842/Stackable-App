package documents

import (
	"context"
	"sort"
	"sync"
	"time"
)

// StaleClaimAfter is how long a RENDERING job may sit before another worker takes it over.
const StaleClaimAfter = 5 * time.Minute

// Store persists documents, the cache index and the outbox.
type Store interface {
	// CreateDocument inserts a document row (used for queued jobs).
	CreateDocument(ctx context.Context, d Document) error
	// CreateRendered inserts a finished document and its cache entry together.
	CreateRendered(ctx context.Context, d Document, c CacheEntry) error
	// GetDocument returns ErrNotFound when the id is unknown or belongs to another school.
	GetDocument(ctx context.Context, schoolID, id string) (Document, error)
	// FindCachedDocument returns the document for an unexpired cache entry.
	FindCachedDocument(ctx context.Context, schoolID, cacheKey string, now time.Time) (Document, bool, error)
	// ClaimQueued marks the oldest queued (or stale rendering) job as RENDERING; works across schools.
	ClaimQueued(ctx context.Context, now time.Time) (Document, bool, error)
	// CompleteJob stores the finished document, its cache entry and the outbox event atomically.
	CompleteJob(ctx context.Context, d Document, c CacheEntry, ev OutboxEvent) error
	// FailJob marks a job FAILED.
	FailJob(ctx context.Context, schoolID, id string, now time.Time) error
	// PurgeExpiredCache deletes expired cache rows only; documents and files stay.
	PurgeExpiredCache(ctx context.Context, now time.Time) (int, error)
}

// MemoryStore is an in-process Store for tests and local runs without a database.
type MemoryStore struct {
	mu     sync.Mutex
	docs   map[string]Document
	cache  map[string]CacheEntry // key: schoolID + "\x00" + cacheKey
	outbox []OutboxEvent
}

// NewMemoryStore returns an empty MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{docs: map[string]Document{}, cache: map[string]CacheEntry{}}
}

func cacheID(schoolID, key string) string { return schoolID + "\x00" + key }

// CreateDocument stores d.
func (m *MemoryStore) CreateDocument(_ context.Context, d Document) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.docs[d.ID] = d
	return nil
}

// CreateRendered stores d and its cache entry.
func (m *MemoryStore) CreateRendered(_ context.Context, d Document, c CacheEntry) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.docs[d.ID] = d
	m.cache[cacheID(c.SchoolID, c.CacheKey)] = c
	return nil
}

// GetDocument returns the document only for its own school.
func (m *MemoryStore) GetDocument(_ context.Context, schoolID, id string) (Document, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	d, ok := m.docs[id]
	if !ok || d.SchoolID != schoolID {
		return Document{}, notFoundErr()
	}
	return d, nil
}

// FindCachedDocument ignores expired entries even before they are purged.
func (m *MemoryStore) FindCachedDocument(_ context.Context, schoolID, cacheKey string, now time.Time) (Document, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.cache[cacheID(schoolID, cacheKey)]
	if !ok || !c.ExpiresAt.After(now) {
		return Document{}, false, nil
	}
	d, ok := m.docs[c.DocumentID]
	return d, ok, nil
}

// ClaimQueued picks the oldest claimable job.
func (m *MemoryStore) ClaimQueued(_ context.Context, now time.Time) (Document, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var ready []Document
	for _, d := range m.docs {
		stale := d.Status == StatusRendering && now.Sub(d.UpdatedAt) > StaleClaimAfter
		if d.Status == StatusQueuedJob || stale {
			ready = append(ready, d)
		}
	}
	if len(ready) == 0 {
		return Document{}, false, nil
	}
	sort.Slice(ready, func(i, j int) bool { return ready[i].CreatedAt.Before(ready[j].CreatedAt) })
	d := ready[0]
	d.Status, d.UpdatedAt = StatusRendering, now
	m.docs[d.ID] = d
	return d, true, nil
}

// CompleteJob applies the three writes under one lock.
func (m *MemoryStore) CompleteJob(_ context.Context, d Document, c CacheEntry, ev OutboxEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.docs[d.ID] = d
	m.cache[cacheID(c.SchoolID, c.CacheKey)] = c
	m.outbox = append(m.outbox, ev)
	return nil
}

// FailJob marks the job FAILED.
func (m *MemoryStore) FailJob(_ context.Context, schoolID, id string, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	d, ok := m.docs[id]
	if !ok || d.SchoolID != schoolID {
		return notFoundErr()
	}
	d.Status, d.UpdatedAt = StatusFailed, now
	m.docs[id] = d
	return nil
}

// PurgeExpiredCache removes expired cache rows and returns how many.
func (m *MemoryStore) PurgeExpiredCache(_ context.Context, now time.Time) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for k, c := range m.cache {
		if !c.ExpiresAt.After(now) {
			delete(m.cache, k)
			n++
		}
	}
	return n, nil
}

// CacheCount returns the number of cache rows (tests).
func (m *MemoryStore) CacheCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.cache)
}

// DocumentCount returns the number of document rows (tests).
func (m *MemoryStore) DocumentCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.docs)
}

// Outbox returns a copy of the outbox rows (tests).
func (m *MemoryStore) Outbox() []OutboxEvent {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]OutboxEvent(nil), m.outbox...)
}
