-- +goose Up
create schema if not exists payments;

create table payments.webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    external_event_id text not null,
    payload jsonb not null,
    received_at timestamptz not null default now(),
    processed_at timestamptz,
    unique (provider, external_event_id)
);

-- +goose Down
drop table payments.webhook_events;
drop schema payments;
