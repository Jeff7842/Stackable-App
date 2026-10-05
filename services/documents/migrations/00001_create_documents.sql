-- +goose Up
create schema if not exists documents;

create table documents.documents (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    type text not null check (type in ('receipt', 'report_card', 'fee_statement', 'class_sheet', 'generic')),
    format text not null check (format in ('pdf', 'xlsx')),
    params jsonb not null default '{}',
    data_version text not null,
    object_key text,
    status text not null check (status in ('QUEUED_JOB', 'RENDERING', 'STORED_AND_CACHED', 'FAILED')),
    render_ms integer,
    job_payload jsonb, -- caller data, only while queued
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index documents_school_idx on documents.documents (school_id, created_at desc);
create index documents_claim_idx on documents.documents (created_at) where status in ('QUEUED_JOB', 'RENDERING');

create table documents.document_cache (
    school_id uuid not null,
    cache_key text not null,
    document_id uuid not null references documents.documents (id),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    primary key (school_id, cache_key)
);
create index document_cache_document_idx on documents.document_cache (document_id);
create index document_cache_expires_idx on documents.document_cache (expires_at);

create table documents.outbox (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    topic text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    published_at timestamptz
);
create index outbox_unpublished_idx on documents.outbox (created_at) where published_at is null;

-- nullif: after a pooled transaction ends the setting is '' (not null) and ''::uuid would raise.
-- The worker setting lets the queue claim and cache purge span schools; only service code sets it.
alter table documents.documents enable row level security;
alter table documents.documents force row level security;
create policy tenant on documents.documents
    using (school_id = nullif(current_setting('app.school_id', true), '')::uuid)
    with check (school_id = nullif(current_setting('app.school_id', true), '')::uuid);
create policy worker on documents.documents using (current_setting('app.worker', true) = 'on');

alter table documents.document_cache enable row level security;
alter table documents.document_cache force row level security;
create policy tenant on documents.document_cache
    using (school_id = nullif(current_setting('app.school_id', true), '')::uuid)
    with check (school_id = nullif(current_setting('app.school_id', true), '')::uuid);
create policy worker on documents.document_cache using (current_setting('app.worker', true) = 'on');

alter table documents.outbox enable row level security;
alter table documents.outbox force row level security;
create policy tenant on documents.outbox
    using (school_id = nullif(current_setting('app.school_id', true), '')::uuid)
    with check (school_id = nullif(current_setting('app.school_id', true), '')::uuid);
create policy worker on documents.outbox using (current_setting('app.worker', true) = 'on');

-- +goose Down
drop table documents.outbox;
drop table documents.document_cache;
drop table documents.documents;
drop schema documents;
