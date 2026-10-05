-- +goose Up
create schema if not exists communication;

create table communication.sender_identities (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    email_from text,
    sms_sender_id text,
    verified boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index sender_identities_school_idx on communication.sender_identities (school_id);

create table communication.notifications (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    type text not null,
    title text not null,
    body text not null,
    urgent boolean not null default false,
    sender_identity_id uuid references communication.sender_identities (id),
    idempotency_key text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, idempotency_key)
);
create index notifications_sender_identity_idx on communication.notifications (sender_identity_id);

create table communication.notification_recipients (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    notification_id uuid not null references communication.notifications (id),
    user_id uuid not null,
    child_ids uuid[] not null default '{}',
    channels_allowed text[] not null,
    email text,
    phone text,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (notification_id, user_id)
);
create index notification_recipients_user_idx on communication.notification_recipients (school_id, user_id);

create table communication.notification_deliveries (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    notification_id uuid not null references communication.notifications (id),
    user_id uuid not null,
    channel text not null check (channel in ('push', 'sms', 'email')),
    status text not null check (status in ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNDELIVERED')),
    attempt integer not null default 0,
    provider_ref text,
    error text,
    claimed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index notification_deliveries_notification_idx on communication.notification_deliveries (notification_id);
create index notification_deliveries_queue_idx on communication.notification_deliveries (created_at) where status = 'QUEUED';
create index notification_deliveries_provider_ref_idx on communication.notification_deliveries (provider_ref) where provider_ref is not null;

create table communication.delivery_callbacks (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    delivery_id uuid not null references communication.notification_deliveries (id),
    provider text not null,
    provider_event_id text not null,
    status text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, provider_event_id)
);
create index delivery_callbacks_delivery_idx on communication.delivery_callbacks (delivery_id);

create table communication.notification_preferences (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    user_id uuid not null,
    type text not null,
    channels text[] not null,
    quiet_start time,
    quiet_end time,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, user_id, type)
);

create table communication.outbox (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    topic text not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
);
create index outbox_unpublished_idx on communication.outbox (created_at) where published_at is null;

-- FORCE is off on purpose: the owner role (worker, callbacks) bypasses RLS, every request path goes through WithSchool.
alter table communication.sender_identities enable row level security;
alter table communication.notifications enable row level security;
alter table communication.notification_recipients enable row level security;
alter table communication.notification_deliveries enable row level security;
alter table communication.delivery_callbacks enable row level security;
alter table communication.notification_preferences enable row level security;
alter table communication.outbox enable row level security;

create policy tenant_isolation on communication.sender_identities
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.notifications
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.notification_recipients
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.notification_deliveries
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.delivery_callbacks
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.notification_preferences
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on communication.outbox
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);

-- +goose Down
drop table communication.outbox;
drop table communication.notification_preferences;
drop table communication.delivery_callbacks;
drop table communication.notification_deliveries;
drop table communication.notification_recipients;
drop table communication.notifications;
drop table communication.sender_identities;
drop schema communication;
