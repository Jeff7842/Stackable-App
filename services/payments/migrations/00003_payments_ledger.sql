-- +goose Up
create table payments.payments (
    id uuid primary key,
    school_id uuid not null,
    student_id uuid,
    payer_user_id text,
    rail text not null check (rail in ('mpesa', 'card', 'bank', 'fake')),
    provider_transaction_id text,
    amount_minor bigint not null check (amount_minor > 0),
    status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'REVERSED', 'FAILED', 'UNMATCHED')),
    failure_code text,
    idempotency_key text not null,
    kind text not null default 'INVOICE_LINE' check (kind in ('INVOICE_LINE', 'EVENT', 'WALLET', 'FUNDRAISER')),
    invoice_line_ids uuid[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, idempotency_key)
);
-- a provider transaction id is unique per provider, across schools, so a webhook finds exactly one payment
create unique index payments_provider_txn_uniq on payments.payments (rail, provider_transaction_id)
    where provider_transaction_id is not null;
create index payments_student_idx on payments.payments (school_id, student_id);
create index payments_created_idx on payments.payments (school_id, created_at);

create table payments.payment_allocations (
    id uuid primary key,
    school_id uuid not null,
    payment_id uuid not null references payments.payments (id),
    target_type text not null check (target_type in ('INVOICE_LINE', 'STUDENT_CREDIT')),
    target_id uuid not null,
    amount_minor bigint not null check (amount_minor > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index payment_allocations_payment_idx on payments.payment_allocations (payment_id);
create index payment_allocations_target_idx on payments.payment_allocations (school_id, target_type, target_id);

-- append-only: a balance is the signed sum of one account; debits are positive, credits negative
create table payments.ledger_entries (
    id uuid primary key,
    school_id uuid not null,
    student_id uuid,
    account text not null,
    kind text not null check (kind in ('DEBIT_INVOICE', 'CREDIT_PAYMENT', 'REFUND', 'ADJUSTMENT')),
    amount_minor bigint not null check (amount_minor <> 0),
    ref_type text not null,
    ref_id uuid not null,
    created_at timestamptz not null default now()
);
create index ledger_entries_balance_idx on payments.ledger_entries (school_id, account, student_id);
create index ledger_entries_ref_idx on payments.ledger_entries (ref_type, ref_id);

-- +goose StatementBegin
create function payments.ledger_entries_immutable() returns trigger language plpgsql as $$
begin
    raise exception 'payments.ledger_entries is append-only (% blocked)', tg_op;
end $$;
-- +goose StatementEnd

create trigger ledger_entries_no_update_delete
    before update or delete on payments.ledger_entries
    for each row execute function payments.ledger_entries_immutable();

create trigger ledger_entries_no_truncate
    before truncate on payments.ledger_entries
    for each statement execute function payments.ledger_entries_immutable();

create table payments.receipt_counters (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null unique,
    last_number bigint not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table payments.receipts (
    id uuid primary key,
    school_id uuid not null,
    payment_id uuid not null unique references payments.payments (id),
    number text not null,
    issued_at timestamptz not null default now(),
    document_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, number)
);

create table payments.unmatched_payments (
    id uuid primary key,
    school_id uuid not null,
    payment_id uuid not null unique references payments.payments (id),
    reason text not null,
    resolved_by text,
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index unmatched_open_idx on payments.unmatched_payments (school_id, payment_id) where resolved_at is null;

create table payments.outbox (
    id uuid primary key,
    school_id uuid not null,
    event_type text not null,
    aggregate_id uuid not null,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    published_at timestamptz
);
create index outbox_unpublished_idx on payments.outbox (created_at) where published_at is null;

-- +goose StatementBegin
do $$
declare t text;
begin
    foreach t in array array['payments', 'payment_allocations', 'ledger_entries', 'receipt_counters', 'receipts', 'unmatched_payments', 'outbox'] loop
        execute format('alter table payments.%I enable row level security', t);
        execute format(
            'create policy tenant_isolation on payments.%I using (school_id = current_setting(''app.school_id'', true)::uuid) with check (school_id = current_setting(''app.school_id'', true)::uuid)',
            t);
    end loop;
end $$;
-- +goose StatementEnd

-- Webhooks carry no token, so this owner-run function is the only cross-school lookup.
-- +goose StatementBegin
create function payments.payment_school(p_rail text, p_txn text) returns uuid
language sql stable security definer set search_path = payments, pg_temp as $$
    select school_id from payments.payments where rail = p_rail and provider_transaction_id = p_txn
$$;
-- +goose StatementEnd

-- +goose Down
drop function payments.payment_school(text, text);
drop table payments.outbox;
drop table payments.unmatched_payments;
drop table payments.receipts;
drop table payments.receipt_counters;
drop table payments.ledger_entries;
drop function payments.ledger_entries_immutable();
drop table payments.payment_allocations;
drop table payments.payments;
