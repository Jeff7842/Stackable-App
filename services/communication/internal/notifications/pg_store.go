package notifications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	kit "github.com/stackable/kyfaru-kit"
)

// Not run against a real database yet. Ids are cast to and from text so pgx never guesses a uuid codec.
const (
	insertNotificationSQL = `
insert into communication.notifications (id, school_id, type, title, body, urgent, idempotency_key)
values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
on conflict (school_id, idempotency_key) do nothing
returning created_at`

	selectByKeySQL = `
select id::text, type, title, body, urgent, sender_identity_id::text, idempotency_key, created_at
from communication.notifications where school_id = $1::uuid and idempotency_key = $2`

	insertRecipientSQL = `
insert into communication.notification_recipients (school_id, notification_id, user_id, child_ids, channels_allowed, email, phone)
values ($1::uuid, $2::uuid, $3::uuid, $4::text[]::uuid[], $5::text[], nullif($6, ''), nullif($7, ''))`

	insertDeliverySQL = `
insert into communication.notification_deliveries (school_id, notification_id, user_id, channel, status)
values ($1::uuid, $2::uuid, $3::uuid, 'push', 'QUEUED')`

	listInboxSQL = `
select n.id::text, n.type, n.title, n.body, n.urgent, n.created_at, r.child_ids::text[], r.read_at
from communication.notification_recipients r
join communication.notifications n on n.id = r.notification_id
where r.school_id = $1::uuid and r.user_id = $2::uuid
  and ($3::timestamptz is null or (n.created_at, n.id::text) < ($3::timestamptz, $4::text))
order by n.created_at desc, n.id desc
limit $5`

	markReadSQL = `
update communication.notification_recipients
set read_at = coalesce(read_at, now()), updated_at = now()
where school_id = $1::uuid and notification_id = $2::uuid and user_id = $3::uuid`

	listPrefsSQL = `
select type, channels, quiet_start::text, quiet_end::text
from communication.notification_preferences
where school_id = $1::uuid and user_id = $2::uuid order by type limit 200`

	findPrefSQL = `
select type, channels, quiet_start::text, quiet_end::text
from communication.notification_preferences
where school_id = $1::uuid and user_id = $2::uuid and type in ($3, '*')
order by (type = '*') limit 1`

	upsertPrefSQL = `
insert into communication.notification_preferences (school_id, user_id, type, channels, quiet_start, quiet_end)
values ($1::uuid, $2::uuid, $3, $4::text[], $5::time, $6::time)
on conflict (school_id, user_id, type)
do update set channels = excluded.channels, quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, updated_at = now()`

	notificationExistsSQL = `select 1 from communication.notifications where id = $1::uuid and school_id = $2::uuid`

	countsSQL = `
select status, count(*) from communication.notification_deliveries
where notification_id = $1::uuid and school_id = $2::uuid group by status`

	claimSQL = `
with claimed as (
  update communication.notification_deliveries d
  set claimed_at = now(), updated_at = now()
  where d.id in (
    select id from communication.notification_deliveries
    where status = 'QUEUED' and (claimed_at is null or claimed_at < now() - make_interval(secs => $2))
    order by created_at limit $1 for update skip locked)
  returning d.id, d.school_id, d.notification_id, d.user_id, d.attempt)
select c.id::text, c.school_id::text, c.notification_id::text, c.user_id::text, c.attempt,
       n.type, n.title, n.body, n.urgent, r.child_ids::text[], r.channels_allowed, coalesce(r.email, ''), coalesce(r.phone, '')
from claimed c
join communication.notifications n on n.id = c.notification_id
join communication.notification_recipients r on r.notification_id = c.notification_id and r.user_id = c.user_id`

	releaseSQL = `
update communication.notification_deliveries set claimed_at = null, updated_at = now()
where id = $1::uuid and school_id = $2::uuid`

	finishSQL = `
update communication.notification_deliveries
set status = $3, channel = coalesce(nullif($4, ''), channel), attempt = $5,
    provider_ref = nullif($6, ''), error = nullif($7, ''), claimed_at = null, updated_at = now()
where id = $1::uuid and school_id = $2::uuid
returning notification_id::text, user_id::text`

	outboxSQL = `
insert into communication.outbox (school_id, topic, payload) values ($1::uuid, $2, $3::jsonb)`

	findByRefSQL = `
select id::text, school_id::text from communication.notification_deliveries where provider_ref = $1 limit 1`

	insertCallbackSQL = `
insert into communication.delivery_callbacks (school_id, delivery_id, provider, provider_event_id, status, payload)
values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
on conflict (provider, provider_event_id) do nothing`

	applyCallbackSQL = `
update communication.notification_deliveries set status = $2, updated_at = now()
where id = $1::uuid and status in ('SENT', 'FAILED')`
)

// PgStore is the Postgres-backed Store.
type PgStore struct {
	pool *pgxpool.Pool
}

// NewPgStore wraps a pool.
func NewPgStore(pool *pgxpool.Pool) *PgStore { return &PgStore{pool: pool} }

// CreateNotification inserts the notification, recipients and deliveries in one school-scoped transaction.
func (s *PgStore) CreateNotification(ctx context.Context, n NewNotification) (Notification, bool, error) {
	out := n.Notification
	created := false
	err := kit.WithSchool(ctx, s.pool, n.SchoolID, func(ctx context.Context, tx pgx.Tx) error {
		err := tx.QueryRow(ctx, insertNotificationSQL, n.ID, n.SchoolID, n.Type, n.Title, n.Body, n.Urgent, n.IdempotencyKey).Scan(&out.CreatedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return tx.QueryRow(ctx, selectByKeySQL, n.SchoolID, n.IdempotencyKey).Scan(
				&out.ID, &out.Type, &out.Title, &out.Body, &out.Urgent, &out.SenderIdentityID, &out.IdempotencyKey, &out.CreatedAt)
		}
		if err != nil {
			return fmt.Errorf("insert notification: %w", err)
		}
		created = true
		batch := &pgx.Batch{}
		for _, r := range n.Recipients {
			batch.Queue(insertRecipientSQL, n.SchoolID, n.ID, r.UserID, r.ChildIDs, r.ChannelsAllowed, r.Email, r.Phone)
			batch.Queue(insertDeliverySQL, n.SchoolID, n.ID, r.UserID)
		}
		br := tx.SendBatch(ctx, batch)
		for range n.Recipients {
			for range 2 {
				if _, err := br.Exec(); err != nil {
					_ = br.Close()
					return fmt.Errorf("insert recipient: %w", err)
				}
			}
		}
		return br.Close()
	})
	return out, created, err
}

// ListInbox pages with a (created_at, id) keyset so deep pages stay fast.
func (s *PgStore) ListInbox(ctx context.Context, schoolID, userID string, limit int, after *Cursor) ([]InboxItem, error) {
	var afterTime *time.Time
	afterID := ""
	if after != nil {
		afterTime, afterID = &after.CreatedAt, after.ID
	}
	items := []InboxItem{}
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		rows, err := tx.Query(ctx, listInboxSQL, schoolID, userID, afterTime, afterID, limit)
		if err != nil {
			return fmt.Errorf("query inbox: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var it InboxItem
			if err := rows.Scan(&it.ID, &it.Type, &it.Title, &it.Body, &it.Urgent, &it.CreatedAt, &it.ChildIDs, &it.ReadAt); err != nil {
				return fmt.Errorf("scan inbox: %w", err)
			}
			items = append(items, it)
		}
		return rows.Err()
	})
	return items, err
}

// MarkRead keeps the first read time on repeats.
func (s *PgStore) MarkRead(ctx context.Context, schoolID, userID, notificationID string) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, markReadSQL, schoolID, notificationID, userID)
		if err != nil {
			return fmt.Errorf("mark read: %w", err)
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return nil
	})
}

func scanPreference(row pgx.Row) (*Preference, error) {
	var p Preference
	if err := row.Scan(&p.Type, &p.Channels, &p.QuietStart, &p.QuietEnd); err != nil {
		return nil, err
	}
	trimClock(p.QuietStart)
	trimClock(p.QuietEnd)
	return &p, nil
}

// trimClock turns Postgres "22:00:00" into "22:00".
func trimClock(t *string) {
	if t != nil && len(*t) > 5 {
		*t = (*t)[:5]
	}
}

// ListPreferences returns every preference row of the user.
func (s *PgStore) ListPreferences(ctx context.Context, schoolID, userID string) ([]Preference, error) {
	out := []Preference{}
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		rows, err := tx.Query(ctx, listPrefsSQL, schoolID, userID)
		if err != nil {
			return fmt.Errorf("query preferences: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			p, err := scanPreference(rows)
			if err != nil {
				return fmt.Errorf("scan preference: %w", err)
			}
			out = append(out, *p)
		}
		return rows.Err()
	})
	return out, err
}

// FindPreference returns the exact-type row, else the AnyType row, else nil.
func (s *PgStore) FindPreference(ctx context.Context, schoolID, userID, notifType string) (*Preference, error) {
	var found *Preference
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		p, err := scanPreference(tx.QueryRow(ctx, findPrefSQL, schoolID, userID, notifType))
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		found = p
		return err
	})
	return found, err
}

// SavePreferences upserts each type in one transaction.
func (s *PgStore) SavePreferences(ctx context.Context, schoolID, userID string, prefs []Preference) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		for _, p := range prefs {
			if _, err := tx.Exec(ctx, upsertPrefSQL, schoolID, userID, p.Type, p.Channels, p.QuietStart, p.QuietEnd); err != nil {
				return fmt.Errorf("upsert preference: %w", err)
			}
		}
		return nil
	})
}

// DeliveryCounts returns a count for every status, zero when absent.
func (s *PgStore) DeliveryCounts(ctx context.Context, schoolID, notificationID string) (map[string]int, error) {
	counts := map[string]int{}
	for _, st := range AllStatuses {
		counts[st] = 0
	}
	err := kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		var one int
		if err := tx.QueryRow(ctx, notificationExistsSQL, notificationID, schoolID).Scan(&one); errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		} else if err != nil {
			return fmt.Errorf("check notification: %w", err)
		}
		rows, err := tx.Query(ctx, countsSQL, notificationID, schoolID)
		if err != nil {
			return fmt.Errorf("count deliveries: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var status string
			var n int64
			if err := rows.Scan(&status, &n); err != nil {
				return fmt.Errorf("scan counts: %w", err)
			}
			counts[status] = int(n)
		}
		return rows.Err()
	})
	return counts, err
}

// ClaimQueued runs across all schools, so the service role must own the tables or bypass RLS.
func (s *PgStore) ClaimQueued(ctx context.Context, limit int, lease time.Duration) ([]Job, error) {
	rows, err := s.pool.Query(ctx, claimSQL, limit, lease.Seconds())
	if err != nil {
		return nil, fmt.Errorf("claim deliveries: %w", err)
	}
	defer rows.Close()
	var jobs []Job
	for rows.Next() {
		var j Job
		if err := rows.Scan(&j.DeliveryID, &j.SchoolID, &j.NotificationID, &j.UserID, &j.Attempt,
			&j.Type, &j.Title, &j.Body, &j.Urgent, &j.ChildIDs, &j.ChannelsAllowed, &j.Email, &j.Phone); err != nil {
			return nil, fmt.Errorf("scan claim: %w", err)
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// ReleaseDelivery clears the claim.
func (s *PgStore) ReleaseDelivery(ctx context.Context, schoolID, deliveryID string) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, releaseSQL, deliveryID, schoolID); err != nil {
			return fmt.Errorf("release delivery: %w", err)
		}
		return nil
	})
}

// FinishDelivery updates the delivery and writes the outbox row in the same transaction.
func (s *PgStore) FinishDelivery(ctx context.Context, schoolID, deliveryID string, res Result) error {
	return kit.WithSchool(ctx, s.pool, schoolID, func(ctx context.Context, tx pgx.Tx) error {
		var notificationID, userID string
		err := tx.QueryRow(ctx, finishSQL, deliveryID, schoolID, res.Status, res.Channel, res.Attempt, res.ProviderRef, res.Error).Scan(&notificationID, &userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("finish delivery: %w", err)
		}
		if res.Status != StatusUndelivered {
			return nil
		}
		payload, err := json.Marshal(map[string]string{"notificationId": notificationID, "userId": userID, "deliveryId": deliveryID})
		if err != nil {
			return fmt.Errorf("marshal outbox payload: %w", err)
		}
		if _, err := tx.Exec(ctx, outboxSQL, schoolID, OutboxTopicUndelivered, string(payload)); err != nil {
			return fmt.Errorf("insert outbox: %w", err)
		}
		return nil
	})
}

// RecordCallback relies on the unique (provider, provider_event_id) key, so concurrent repeats store one row.
func (s *PgStore) RecordCallback(ctx context.Context, ev CallbackEvent) (CallbackOutcome, error) {
	var out CallbackOutcome
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return out, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after commit

	var deliveryID, schoolID string
	if err := tx.QueryRow(ctx, findByRefSQL, ev.ProviderRef).Scan(&deliveryID, &schoolID); errors.Is(err, pgx.ErrNoRows) {
		return out, nil
	} else if err != nil {
		return out, fmt.Errorf("find delivery: %w", err)
	}
	out.Matched = true
	tag, err := tx.Exec(ctx, insertCallbackSQL, schoolID, deliveryID, ev.Provider, ev.EventID, ev.Status, string(ev.Payload))
	if err != nil {
		return out, fmt.Errorf("insert callback: %w", err)
	}
	if tag.RowsAffected() == 0 {
		out.Duplicate = true
		return out, nil
	}
	if _, err := tx.Exec(ctx, applyCallbackSQL, deliveryID, ev.Status); err != nil {
		return out, fmt.Errorf("apply callback: %w", err)
	}
	return out, tx.Commit(ctx)
}
