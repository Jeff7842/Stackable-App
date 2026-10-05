-- +goose Up
create schema if not exists ai;

create table ai.ai_policies (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null unique,
    hints_per_question int not null default 3 check (hints_per_question >= 0),
    practice_items int not null default 5 check (practice_items >= 0),
    unaided_points int not null default 10 check (unaided_points >= 0),
    practice_set_points int not null default 5 check (practice_set_points >= 0),
    daily_allowance_base int not null default 10 check (daily_allowance_base >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table ai.allowance_tiers (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    min_points int not null check (min_points >= 0),
    daily_requests int not null check (daily_requests >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, min_points)
);

create table ai.ai_sessions (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    student_id uuid not null,
    question_id text not null,
    kind text not null check (kind in ('tutor', 'tool')),
    state jsonb not null,
    hints_used int not null default 0,
    practice_completed boolean not null default false,
    version int not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (school_id, student_id, question_id),
    unique (school_id, id)
);

create table ai.ai_messages (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    session_id uuid not null references ai.ai_sessions (id),
    role text not null check (role in ('student', 'assistant')),
    -- Never holds an answer key; the service stores only the safe reply.
    content text not null,
    leak_flagged boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table ai.practice_sets (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    session_id uuid not null references ai.ai_sessions (id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- answer_key is read only by the ai service role, never by a student-facing path.
create table ai.practice_items (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    set_id uuid not null references ai.practice_sets (id),
    position int not null check (position >= 0),
    question text not null,
    answer_key text not null,
    difficulty int not null check (difficulty between 1 and 5),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (set_id, position)
);

-- Append-only: points are never edited, only added.
create table ai.achievement_ledger (
    id uuid primary key default gen_random_uuid(),
    school_id uuid not null,
    student_id uuid not null,
    question_id text not null,
    reason text not null check (reason in ('UNAIDED_CORRECT', 'PRACTICE_SET_DONE')),
    points int not null check (points >= 0),
    created_at timestamptz not null default now(),
    unique (school_id, student_id, question_id, reason)
);

create index ai_messages_session_idx on ai.ai_messages (session_id);
create index ai_messages_school_created_idx on ai.ai_messages (school_id, created_at);
create index practice_sets_session_idx on ai.practice_sets (session_id);
create index practice_items_set_idx on ai.practice_items (set_id);
create index ai_sessions_student_idx on ai.ai_sessions (school_id, student_id);
create index achievement_ledger_student_idx on ai.achievement_ledger (school_id, student_id);

-- +goose StatementBegin
create function ai.reject_ledger_change() returns trigger language plpgsql as $$
begin
    raise exception 'achievement_ledger is append-only';
end;
$$;
-- +goose StatementEnd

create trigger achievement_ledger_append_only
    before update or delete on ai.achievement_ledger
    for each row execute function ai.reject_ledger_change();

alter table ai.ai_policies enable row level security;
alter table ai.allowance_tiers enable row level security;
alter table ai.ai_sessions enable row level security;
alter table ai.ai_messages enable row level security;
alter table ai.practice_sets enable row level security;
alter table ai.practice_items enable row level security;
alter table ai.achievement_ledger enable row level security;

create policy tenant_isolation on ai.ai_policies
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.allowance_tiers
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.ai_sessions
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.ai_messages
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.practice_sets
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.practice_items
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);
create policy tenant_isolation on ai.achievement_ledger
    using (school_id = current_setting('app.school_id', true)::uuid)
    with check (school_id = current_setting('app.school_id', true)::uuid);

-- +goose Down
drop table ai.achievement_ledger;
drop table ai.practice_items;
drop table ai.practice_sets;
drop table ai.ai_messages;
drop table ai.ai_sessions;
drop table ai.allowance_tiers;
drop table ai.ai_policies;
drop function ai.reject_ledger_change();
drop schema ai;
