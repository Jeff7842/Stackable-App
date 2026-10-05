-- +goose Up
create table payments.fee_structures (
    id uuid primary key,
    school_id uuid not null,
    term text not null,
    level text not null,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, term, level, name)
);

create table payments.fee_items (
    id uuid primary key,
    school_id uuid not null,
    fee_structure_id uuid not null references payments.fee_structures (id),
    name text not null,
    amount_minor bigint not null check (amount_minor > 0),
    mandatory boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index fee_items_structure_idx on payments.fee_items (fee_structure_id);

create table payments.invoices (
    id uuid primary key,
    school_id uuid not null,
    student_id uuid not null,
    fee_structure_id uuid references payments.fee_structures (id),
    term text not null,
    status text not null default 'ISSUED' check (status in ('ISSUED', 'PARTIAL', 'PAID')),
    issued_at timestamptz not null default now(),
    total_minor bigint not null check (total_minor > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index invoices_student_idx on payments.invoices (school_id, student_id, term);
create index invoices_structure_idx on payments.invoices (fee_structure_id);
-- one invoice per student, term and structure, so a repeated run cannot double-bill
create unique index invoices_once_per_structure on payments.invoices (school_id, student_id, term, fee_structure_id)
    where fee_structure_id is not null;

create table payments.invoice_lines (
    id uuid primary key,
    school_id uuid not null,
    invoice_id uuid not null references payments.invoices (id),
    fee_item_id uuid references payments.fee_items (id),
    description text not null,
    amount_minor bigint not null check (amount_minor > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index invoice_lines_invoice_idx on payments.invoice_lines (invoice_id);
create index invoice_lines_fee_item_idx on payments.invoice_lines (fee_item_id);

-- +goose StatementBegin
do $$
declare t text;
begin
    foreach t in array array['fee_structures', 'fee_items', 'invoices', 'invoice_lines'] loop
        execute format('alter table payments.%I enable row level security', t);
        execute format(
            'create policy tenant_isolation on payments.%I using (school_id = current_setting(''app.school_id'', true)::uuid) with check (school_id = current_setting(''app.school_id'', true)::uuid)',
            t);
    end loop;
end $$;
-- +goose StatementEnd

-- +goose Down
drop table payments.invoice_lines;
drop table payments.invoices;
drop table payments.fee_items;
drop table payments.fee_structures;
