# communication

Go service that is the only sender of messages. The caller sends already-resolved recipients; this service
dedupes to one message per parent (listing their child ids), queues one delivery each, and a background worker
sends them with fallback `push -> sms -> email`.

## Run

```
go run ./cmd/communication
```

Without `DATABASE_URL` it runs with an in-memory store and fake adapters (dev only); `/ready` reports `degraded`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4006` | HTTP port |
| `SERVICE_TOKEN_SECRET` | required | HS256 secret; tokens use issuer `stackable-gateway`, audience `communication` |
| `DATABASE_URL` | unset | Postgres URL; required when `APP_ENV=production` |
| `APP_ENV` | unset | `production` refuses the memory store, fake adapters and the fake callback verifier |
| `WORKER_INTERVAL_SECONDS` | `5` | Worker tick |
| `QUIET_HOURS_TZ` | `Africa/Nairobi` | Time zone quiet hours are read in |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | unset | Email adapter; disabled unless both set |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` | unset | Africa's Talking SMS adapter (sender id optional); disabled unless username and key set |

Push has no provider yet: a fake in dev, a disabled stub in production.

## Endpoints

All `/v1` routes need a service token; the school comes from the token, the user from its subject.
Errors use `{ error, code, details, requestId }`. Full contract: `packages/contracts/openapi/communication.yaml`.

| Route | Purpose |
|---|---|
| `POST /v1/notifications` | Create. 201 when new, 200 with the original when `idempotencyKey` repeats |
| `GET /v1/inbox?limit&cursor` | The caller's notifications, newest first |
| `POST /v1/inbox/{id}/read` | Mark read (idempotent) |
| `GET` / `PUT /v1/preferences` | Per-type channels and quiet hours; PUT upserts the listed types (`*` = default) |
| `GET /v1/notifications/{id}/deliveries` | Count per status |
| `POST /v1/callbacks/{provider}` | Public provider report (`fake`, `resend`, `africastalking`), stored once per provider event id |

Rules in the worker: channels are filtered by `channelsAllowed` and the user's preference (exact type, else `*`).
Quiet hours are skipped (delivery waits) unless `urgent` or type `safety`. If every channel fails, or none is left,
the delivery becomes `UNDELIVERED` and a `delivery.undelivered` outbox row is written in the same transaction.

## Migrations

`goose -dir migrations postgres "$DATABASE_URL" up`. RLS is enabled (not forced) on every table. The worker and the
public callback run without a school, so the service role must own the tables or have BYPASSRLS.
`internal/notifications/pg_store.go` and the migration have NOT been run against a real database; only the memory store is tested.

## Test

```
go vet ./... && go test ./...
```

Quick check:

```
curl -X POST localhost:4006/v1/notifications -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"fees","title":"Fee due","body":"Please pay","idempotencyKey":"k1","recipients":[{"userId":"<uuid>","childIds":["<uuid>"]}]}'
```
