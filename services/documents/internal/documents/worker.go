package documents

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

const (
	TopicDocumentReady = "document.ready"
	purgeEvery         = time.Hour // expired cache rows are harmless, so purging is not urgent
)

// ProcessNext renders one queued job and writes the document.ready outbox row; false means the queue is empty.
// A failed render marks the job FAILED instead of retrying forever on bad data.
func (s *Service) ProcessNext(ctx context.Context) (bool, error) {
	now := s.cfg.Clock()
	doc, ok, err := s.cfg.Store.ClaimQueued(ctx, now)
	if err != nil || !ok {
		return false, err
	}
	fail := func(cause error) (bool, error) {
		if ferr := s.cfg.Store.FailJob(ctx, doc.SchoolID, doc.ID, s.cfg.Clock()); ferr != nil {
			return true, fmt.Errorf("fail job: %w (after %v)", ferr, cause)
		}
		return true, cause
	}
	content, err := ParseContent(doc.Type, doc.JobPayload)
	if err != nil {
		return fail(err)
	}
	if err := s.render(ctx, &doc, content); err != nil {
		return fail(err)
	}
	key, err := CacheKey(doc.SchoolID, doc.Type, doc.Params, doc.DataVersion, doc.Format)
	if err != nil {
		return fail(err)
	}
	payload, _ := json.Marshal(map[string]string{
		"documentId": doc.ID, "schoolId": doc.SchoolID, "type": string(doc.Type), "format": string(doc.Format),
	}) // a map of strings cannot fail to marshal
	entry := CacheEntry{SchoolID: doc.SchoolID, CacheKey: key, DocumentID: doc.ID, ExpiresAt: s.cfg.Clock().Add(s.cfg.CacheTTL)}
	ev := OutboxEvent{ID: newUUID(), SchoolID: doc.SchoolID, Topic: TopicDocumentReady, Payload: payload, CreatedAt: s.cfg.Clock()}
	if err := s.cfg.Store.CompleteJob(ctx, doc, entry, ev); err != nil {
		return fail(err)
	}
	return true, nil
}

// RunWorker drains the queue every interval and purges expired cache rows hourly until ctx ends.
func (s *Service) RunWorker(ctx context.Context, interval time.Duration, logger *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	var lastPurge time.Time
	for {
		for {
			more, err := s.ProcessNext(ctx)
			if err != nil {
				logger.Error("document job failed", "err", err)
			}
			if !more {
				break
			}
		}
		if time.Since(lastPurge) >= purgeEvery {
			n, err := s.PurgeExpired(ctx)
			if err != nil {
				logger.Error("cache purge failed", "err", err)
			} else {
				logger.Info("cache purged", "rows", n)
			}
			lastPurge = time.Now()
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
