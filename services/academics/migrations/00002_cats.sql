-- +goose Up
create table academics.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  title text not null,
  type text not null check (type in ('cat', 'quiz')), -- exams are a separate future module
  class_id text not null,
  subject_id text,
  teacher_id text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'MARKED', 'RELEASED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index assessments_school_idx on academics.assessments (school_id);
create index assessments_class_status_idx on academics.assessments (class_id, status);

create table academics.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_id uuid not null references academics.assessments (id) on delete cascade,
  position integer not null,
  type text not null check (type in ('short_answer', 'multiple_choice', 'reorder', 'calculation')),
  stem text not null,
  marks double precision not null check (marks > 0),
  choices jsonb,
  answer_key jsonb,
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);
create index assessment_questions_school_idx on academics.assessment_questions (school_id);

create table academics.calc_specs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  question_id uuid not null unique references academics.assessment_questions (id) on delete cascade,
  expected_value double precision not null,
  tolerance double precision not null check (tolerance >= 0),
  created_at timestamptz not null default now()
);
create index calc_specs_school_idx on academics.calc_specs (school_id);

create table academics.assessment_accommodations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_id uuid not null references academics.assessments (id) on delete cascade,
  student_id text not null,
  extra_minutes integer not null check (extra_minutes > 0),
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index assessment_accommodations_school_idx on academics.assessment_accommodations (school_id);

create table academics.attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_id uuid not null references academics.assessments (id) on delete cascade,
  student_id text not null,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_MARKING', 'MARKED', 'AUTO_SUBMITTED')),
  started_at timestamptz,
  due_at timestamptz, -- start + duration + accommodation, from the server clock
  submitted_at timestamptz,
  extra_minutes integer not null default 0,
  score double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index attempts_student_idx on academics.attempts (student_id);
create index attempts_school_idx on academics.attempts (school_id);
create index attempts_due_idx on academics.attempts (due_at) where status = 'IN_PROGRESS';

create table academics.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  attempt_id uuid not null references academics.attempts (id) on delete cascade,
  question_id uuid not null references academics.assessment_questions (id),
  response jsonb,
  marks_awarded double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index attempt_answers_question_idx on academics.attempt_answers (question_id);
create index attempt_answers_school_idx on academics.attempt_answers (school_id);

create table academics.paper_scans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  attempt_id uuid not null references academics.attempts (id) on delete cascade,
  object_key text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index paper_scans_attempt_idx on academics.paper_scans (attempt_id);
create index paper_scans_school_idx on academics.paper_scans (school_id);

-- +goose StatementBegin
-- Cross-tenant by design: returns ids only, so the deadline worker can find schools without bypassing RLS.
create function academics.due_attempt_school_ids(p_now timestamptz)
returns table (school_id uuid)
language sql
security definer
set search_path = academics, pg_temp
as $$
  select distinct a.school_id from academics.attempts a where a.status = 'IN_PROGRESS' and a.due_at < p_now;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
do $$
declare t text;
begin
  foreach t in array array['assessments', 'assessment_questions', 'calc_specs', 'assessment_accommodations',
    'attempts', 'attempt_answers', 'paper_scans']
  loop
    execute format('alter table academics.%I enable row level security', t);
    execute format('alter table academics.%I force row level security', t);
    execute format(
      'create policy tenant_isolation on academics.%I using (school_id = current_setting(''app.school_id'', true)::uuid) with check (school_id = current_setting(''app.school_id'', true)::uuid)',
      t);
  end loop;
end $$;
-- +goose StatementEnd

-- +goose Down
drop function if exists academics.due_attempt_school_ids(timestamptz);
drop table if exists academics.paper_scans;
drop table if exists academics.attempt_answers;
drop table if exists academics.attempts;
drop table if exists academics.assessment_accommodations;
drop table if exists academics.calc_specs;
drop table if exists academics.assessment_questions;
drop table if exists academics.assessments;
