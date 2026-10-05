# payments

Go service for fees, payments and the ledger (Fees MVP). Money is `int64` minor units (KES cents). A
balance is the signed sum of the append-only `ledger_entries` (debits positive, credits negative).
Contract: `packages/contracts/openapi/payments.yaml`.

## Routes

All `/v1` routes need a service token (issuer `stackable-gateway`, audience `payments`, school from the
token). Only the webhook is public. Errors use `{ error, code, details, requestId }`.

| Route | Purpose |
|---|---|
| `POST/GET /v1/fee-structures` | price lists (term, level, name, items) |
| `POST /v1/invoices` | issue to students from a structure (mandatory items) or custom lines; invoice, lines and `DEBIT_INVOICE` entries in one transaction |
| `GET /v1/students/{id}/statement` | ledger balance, per-term lines, payments |
| `POST /v1/payments/intent` | PENDING payment plus provider call; same `idempotencyKey` returns the same payment |
| `GET /v1/payments/{id}` | status polling |
| `POST /v1/webhooks/{provider}` | `mpesa` or `fake`; applied once |
| `GET /v1/unmatched`, `POST /v1/unmatched/{id}/resolve` | queue and resolution |
| `GET /v1/reconciliation?from&to` | rows for the Excel export (documents service) |

## Rules worth knowing

- **Webhook once:** the event row, status change, allocations, `CREDIT_PAYMENT` entry, receipt and the
  `payment.confirmed` outbox row commit in one transaction. A repeat (same event id) changes nothing, and a late
  event for a payment that is no longer PENDING is ignored, so two event ids cannot double-credit.
- **States:** PENDING, CONFIRMED, FAILED, UNMATCHED, REVERSED (schema only; refunds are not exposed yet).
- **Overpayment rule:** accepted, never rejected after money moved. The intent itself may not exceed what is
  outstanding on the chosen lines. If lines were paid by another payment meanwhile, the extra becomes a
  `STUDENT_CREDIT` allocation; the ledger shows it as a negative balance. Credit is not auto-applied to later invoices.
- **Unmatched:** a successful event for no known payment (needs a `schoolId` hint, fake only) or with an amount
  that differs from the intent is booked to the `UNMATCHED_SUSPENSE` account and queued. Resolve clears the
  suspense with an `ADJUSTMENT` and then confirms normally. Events with no determinable school are only stored.
- **Provider errors:** `INSUFFICIENT_FUNDS`, `WRONG_PIN`, `USER_CANCELLED` (402), `TIMEOUT` (504), `RAIL_DOWN`
  (503), exposed as `PAYMENT_<CODE>` with `details.paymentId`; the payment is stored as FAILED with `failureCode`.
- **Tenancy:** every table has `school_id` plus an RLS policy on `app.school_id`, and every query also filters
  by school. `payments.payment_school()` is a security-definer lookup so a webhook (no token) finds its school.

## Providers

`internal/provider`: `PaymentProvider{Initiate, VerifyWebhook, Refund}`.

- `fake`: deterministic. Payer phone `254700000003` times out, `254700000005` is rail down. Webhook body:
  `{"id","transactionId","status":"success|failed","failureCode","amountMinor","schoolId","studentId"}`.
  Disabled when `APP_ENV=production` unless `ENABLE_FAKE_PROVIDER=true` (it has no signature).
- `mpesa`: Daraja STK push (OAuth, `processrequest`, callback parsing). Disabled unless all `MPESA_*` are set.
  Daraja does not sign callbacks: only payments we initiated can be confirmed; allowlist Safaricom IPs at the proxy.
  Refund is not supported yet.

## Environment

| Variable | Meaning |
|---|---|
| `PORT` (4005), `APP_ENV`, `DATABASE_URL` | as before; the in-memory store is refused in production |
| `SERVICE_TOKEN_SECRET` | required: the service refuses to start without it |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | enable the mpesa rail |
| `MPESA_BASE_URL` | optional, defaults to the Daraja sandbox |
| `ENABLE_FAKE_PROVIDER` | `true` to allow the fake provider in production |

## Run, migrate, test

```
SERVICE_TOKEN_SECRET=dev go run ./cmd/payments
goose -dir migrations postgres "$DATABASE_URL" up
go vet ./... && go test ./...
```

`go test -race` needs cgo (a C compiler); it was not available on the build machine, so tests ran without it.

## Status and gaps

- `internal/fees/pg_store.go` and migrations `00002`, `00003` are written to match each other but were **not run
  against a real Postgres**. The in-memory store (copy on begin, swap on commit) is what the tests use.
- Not built: wallet, event and fundraiser payments, refund endpoint, card and bank rails, outbox relay,
  sqlc (queries are hand-written in the store).
