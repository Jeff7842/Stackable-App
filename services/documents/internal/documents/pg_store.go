package documents

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	kit "github.com/stackable/go-kit"
)

const docCols = `id::text, school_id::text, type, format, params, data_version, object_key, status, render_ms, job_payload, created_at, updated_at`

const (
	insertDocSQL = `insert into documents.documents
(id, school_id, type, format, params, data_version, object_key, status, render_ms, job_payload, created_at, updated_at)
values ($1::uuid, $2::uuid, $3, $4, $5, $6, nullif($7, ''), $8, $9, $10, $11, $12)`

	upsertCacheSQL = `insert into documents.document_cache (school_id, cache_key, document_id, expires_at)
values ($1::uuid, $2, $3::uuid, $4)
on conflict (school_id, cache_key) do update set document_id = excluded.document_id, expires_at = excluded.expires_at`

	updateDocSQL = `update documents.documents
set object_key = $2, status = $3, render_ms = $4, job_payload = null, updated_at = $5 where id = $1::uuid`
)

// PgStore is the Postgres Store; every tenant query runs inside kit.WithSchool so RLS applies.
type PgStore struct {
	pool *pgxpool.Pool
}

// NewPgStore wraps a pool.
func NewPgStore(pool *pgxpool.Pool) *PgStore { return &PgStore{pool: pool} }

func scanDoc(row pgx.Row) (Document, error) {
	var (
		d       Document
		key     *string
		ms      *int32
		params  []byte
		payload []byte
	)
	err := row.Scan(&d.ID, &d.SchoolID, &d.Type, &d.Format, &params, &d.DataVersion, &key, &d.Status, &ms, &payload, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return Document{}, err
	}
	d.Params, d.JobPayload = params, payload
	if key != nil {
		d.ObjectKey = *key
	}
	if ms != nil {
		d.RenderMs = int64(*ms)
	}
	return d, nil
}

func insertDoc(ctx context.Context, tx pgx.Tx, d Document) error {
	_, err := tx.Exec(ctx, insertDocSQL, d.ID, d.SchoolID, string(d.Type), string(d.Format), []byte(d.Params), d.DataVersion,
		d.ObjectKey, string(d.Status), int32(d.RenderMs), []byte(d.JobPayload), d.CreatedAt, d.UpdatedAt)
	return err
}

func upsertCache(ctx context.Context, tx pgx.Tx, c CacheEntry) error {
	_, err := tx.Exec(ctx, upsertCacheSQL, c.SchoolID, c.CacheKey, c.DocumentID, c.ExpiresAt)
	return err
}

// CreateDocument inserts a queued document.
func (s *PgStore) CreateDocument(ctx context.Context, d Document) error {
	return kit.WithSchool(ctx, s.pool, d.SchoolID, func(ctx context.Context, tx pgx.Tx) error { return insertDoc(ctx, tx, d) })
}

// CreateRendered inserts the document and its cache entry in one transaction.
func (s *PgStore) CreateRendered(ctx context.Context, d Document, c CacheEntry) error {
	return kit.WithSchool(ctx, s.pool, d.SchoolID, func(ctx context.Context, tx pgx.Tx) error {
		if err := insertDoc(ctx, tx, d); err != nil {
			return err
		}
		return upsertCache(ctx, tx, c)
	})
}

// GetDocument returns notFoundErr for unknown ids and other schools' rows (RLS hides them).
func (s *PgStore) GetDocument(ctx context.Context, schoolID, id string) (Document, error) {
	var d Document
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		var err error
		d, err = scanDoc(tx.QueryRow(ctx, `select `+docCols+` from documents.documents where id = $1::uuid`, id))
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, notFoundErr()
	}
	return d, err
}

// FindCachedDocument joins the cache row to its document, ignoring expired rows.
func (s *PgStore) FindCachedDocument(ctx context.Context, schoolID, cacheKey string, now time.Time) (Document, bool, error) {
	var d Document
	found := true
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		var err error
		d, err = scanDoc(tx.QueryRow(ctx, `select `+docCols+` from documents.documents
where id = (select document_id from documents.document_cache where school_id = $1::uuid and cache_key = $2 and expires_at > $3)`,
			schoolID, cacheKey, now))
		if errors.Is(err, pgx.ErrNoRows) {
			found = false
			return nil
		}
		return err
	})
	return d, found && err == nil, err
}

func beginWorker(ctx context.Context, pool *pgxpool.Pool) (pgx.Tx, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	if _, err := tx.Exec(ctx, "select set_config('app.worker', 'on', true)"); err != nil {
		_ = tx.Rollback(ctx)
		return nil, fmt.Errorf("set app.worker: %w", err)
	}
	return tx, nil
}

// ClaimQueued uses SKIP LOCKED so two workers never take the same job.
func (s *PgStore) ClaimQueued(ctx context.Context, now time.Time) (Document, bool, error) {
	tx, err := beginWorker(ctx, s.pool)
	if err != nil {
		return Document{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after commit
	d, err := scanDoc(tx.QueryRow(ctx, `update documents.documents set status = 'RENDERING', updated_at = $1
where id = (select id from documents.documents
  where status = 'QUEUED_JOB' or (status = 'RENDERING' and updated_at < $1::timestamptz - make_interval(secs => $2))
  order by created_at limit 1 for update skip locked)
returning `+docCols, now, StaleClaimAfter.Seconds()))
	if errors.Is(err, pgx.ErrNoRows) {
		return Document{}, false, nil
	}
	if err != nil {
		return Document{}, false, err
	}
	d.Status, d.UpdatedAt = StatusRendering, now
	return d, true, tx.Commit(ctx)
}

// CompleteJob updates the document, writes the cache row and the outbox row in one transaction.
func (s *PgStore) CompleteJob(ctx context.Context, d Document, c CacheEntry, ev OutboxEvent) error {
	return kit.WithSchool(ctx, s.pool, d.SchoolID, func(ctx context.Context, tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, updateDocSQL, d.ID, d.ObjectKey, string(d.Status), int32(d.RenderMs), d.UpdatedAt); err != nil {
			return err
		}
		if err := upsertCache(ctx, tx, c); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `insert into documents.outbox (id, school_id, topic, payload, created_at) values ($1::uuid, $2::uuid, $3, $4, $5)`,
			ev.ID, ev.SchoolID, ev.Topic, []byte(ev.Payload), ev.CreatedAt)
		return err
	})
}

// FailJob marks the job FAILED.
func (s *PgStore) FailJob(ctx context.Context, schoolID, id string, now time.Time) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `update documents.documents set status = 'FAILED', updated_at = $2 where id = $1::uuid`, id, now)
		return err
	})
}

// PurgeExpiredCache deletes cache rows only.
func (s *PgStore) PurgeExpiredCache(ctx context.Context, now time.Time) (int, error) {
	tx, err := beginWorker(ctx, s.pool)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after commit
	tag, err := tx.Exec(ctx, `delete from documents.document_cache where expires_at <= $1`, now)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), tx.Commit(ctx)
}
