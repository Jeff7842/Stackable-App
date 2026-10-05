# payments

Go service for fees, payments and the ledger. Today it has `/health`, `/ready` and one endpoint:
`POST /v1/webhooks/{provider}` (providers: `fake`, `paystack`, `mpesa`). A webhook is stored once per
`(provider, external_event_id)`; a repeat returns 200 with `"duplicate": true` and changes nothing.

## Run

```
go run ./cmd/payments
```

Without `DATABASE_URL` it runs in dev with an in-memory store and `/ready` reports `degraded`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4005` | HTTP port |
| `DATABASE_URL` | unset | Postgres URL; required when `APP_ENV=production` |
| `APP_ENV` | unset | Set to `production` to refuse the in-memory store |
| `SERVICE_TOKEN_SECRET` | unset | Used by go-kit's service-token middleware once internal routes exist |

## Migrations and queries

- Apply `migrations/*.sql` with goose: `goose -dir migrations postgres "$DATABASE_URL" up`.
- `sqlc.yaml` and `queries/` are ready, but sqlc is not installed here, so
  `internal/webhooks/pg_store.go` holds the same query by hand. Run `sqlc generate` later and swap it in.

## Test

```
go vet ./... && go test ./...
```

Money in this service is `int64` minor units (note only; no money logic yet).
