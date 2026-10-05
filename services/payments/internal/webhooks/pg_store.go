package webhooks

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Hand-written to match queries/webhook_events.sql until sqlc is installed.
const insertWebhookEventSQL = `
insert into payments.webhook_events (provider, external_event_id, payload)
values ($1, $2, $3)
on conflict (provider, external_event_id) do nothing`

// PgStore is the Postgres-backed Store.
type PgStore struct {
	pool *pgxpool.Pool
}

// NewPgStore wraps a pool.
func NewPgStore(pool *pgxpool.Pool) *PgStore {
	return &PgStore{pool: pool}
}

// Insert relies on the unique constraint, so two concurrent repeats still store one row.
func (s *PgStore) Insert(ctx context.Context, ev Event) (bool, error) {
	tag, err := s.pool.Exec(ctx, insertWebhookEventSQL, ev.Provider, ev.ExternalEventID, []byte(ev.Payload))
	if err != nil {
		return false, fmt.Errorf("insert webhook event: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}
