# documents

Go service that renders receipts and reports to PDF or Excel, caches them for 3 days and hands out signed links.
It is the only renderer in the system. Callers fetch their own data and send it in the request.

## Run

```
SERVICE_TOKEN_SECRET=dev-secret go run ./cmd/documents
```

Without `DATABASE_URL` it uses an in-memory store and `/ready` reports `degraded`. Without `R2_ENDPOINT`
files go to `DOCS_DIR` on local disk.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4007` | HTTP port |
| `SERVICE_TOKEN_SECRET` | required | HS256 secret for service tokens (audience `documents`) |
| `SERVICE_TOKEN_ISSUER` | `gateway` | Expected token issuer |
| `DATABASE_URL` | unset | Postgres URL; required when `APP_ENV=production` |
| `APP_ENV` | unset | `production` refuses the in-memory store and an unset signing secret |
| `DOCS_DIR` | `./data/documents` | Local file store directory |
| `FILES_SIGNING_SECRET` | random in dev | HMAC key for local download links; required in production |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PRIVATE` | unset | Cloudflare R2; all four or none. When set it replaces the local store |

## Endpoints

Full contract: `packages/contracts/openapi/documents.yaml`. Errors use `{ error, code, details, requestId }`.

- `POST /v1/documents` (service token). Body: `type`, `format`, `params`, `dataVersion`, `data`. The school comes from the token.
  - `200 SERVED`: cache hit, `{id, status, url}`.
  - `201 STORED_AND_CACHED`: rendered now (500 rows or fewer), `{id, status, url, renderMs}`.
  - `202 QUEUED_JOB`: more than 500 rows; a worker renders it and writes a `document.ready` outbox row.
- `GET /v1/documents/{id}` (service token): status and a fresh signed url.
- `GET /v1/files/{key}?exp=&sig=` (local store only): the signature is the credential.
- `GET /health`, `GET /ready`.

Cache key = sha256(type, canonical params, dataVersion, format, schoolId). Change `dataVersion` whenever the
source data changes; an old file is then never served. Cache rows expire after 3 days and an hourly purge
removes them. The purge never touches the stored file or the `documents` row.

`data` shapes: `receipt` takes `{schoolName, receiptNo, payerName, issuedAt, lines:[{description, amountMinor}]}`
(total is summed from the lines). Every other type takes `{schoolName, title, columns:[{key,label,money}], rows:[{...}]}`;
money cells are integer minor units shown as `KES 1,234.56`.

## Database

`migrations/00001_create_documents.sql` (goose) creates schema `documents` with `documents`, `document_cache`
and `outbox`, all with RLS. The worker claims jobs and purges across schools through a second policy keyed on
`app.worker = 'on'`. The Postgres store and the migration are not tested against a real database yet; the
tests use the in-memory store.

## Test

```
go vet ./... && go test ./...
```
