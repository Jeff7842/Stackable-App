-- +goose Up
create schema if not exists academics;

create table academics.outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index outbox_unpublished_idx on academics.outbox (created_at) where published_at is null;
create index outbox_school_idx on academics.outbox (school_id);

create table academics.questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  type text not null check (type in ('short_answer', 'multiple_choice', 'research')),
  stem text not null,
  marks double precision not null check (marks >= 0),
  answer_key text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_school_idx on academics.questions (school_id);

create table academics.question_options (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  question_id uuid not null references academics.questions (id) on delete cascade,
  position integer not null,
  label text not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
create index question_options_question_idx on academics.question_options (question_id);
create index question_options_school_idx on academics.question_options (school_id);

create table academics.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id text not null,
  subject_id text not null,
  teacher_id text not null,
  title text not null,
  due_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at >= due_at)
);
create index assignments_school_idx on academics.assignments (school_id);
create index assignments_class_status_idx on academics.assignments (class_id, status);
create index assignments_teacher_idx on academics.assignments (teacher_id);

create table academics.assignment_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assignment_id uuid not null references academics.assignments (id) on delete cascade,
  question_id uuid not null references academics.questions (id),
  position integer not null,
  marks double precision not null check (marks >= 0),
  created_at timestamptz not null default now(),
  unique (assignment_id, position)
);
create index assignment_items_question_idx on academics.assignment_items (question_id);
create index assignment_items_school_idx on academics.assignment_items (school_id);

create table academics.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assignment_id uuid not null references academics.assignments (id) on delete cascade,
  student_id text not null,
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'RETURNED', 'REJECTED', 'MISSED')),
  submitted_at timestamptz,
  late boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index assignment_submissions_student_idx on academics.assignment_submissions (student_id);
create index assignment_submissions_school_idx on academics.assignment_submissions (school_id);

create table academics.answers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  submission_id uuid not null references academics.assignment_submissions (id) on delete cascade,
  item_id uuid not null references academics.assignment_items (id),
  response_text text,
  selected_option_id uuid references academics.question_options (id),
  marks_awarded double precision,
  ai_gate_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, item_id)
);
create index answers_item_idx on academics.answers (item_id);
create index answers_option_idx on academics.answers (selected_option_id);
create index answers_school_idx on academics.answers (school_id);

create table academics.review_decisions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  submission_id uuid not null references academics.assignment_submissions (id) on delete cascade,
  decision text not null check (decision in ('APPROVED', 'RETURNED', 'REJECTED')),
  reason text,
  reviewer_id text not null,
  created_at timestamptz not null default now(),
  check (decision = 'APPROVED' or (reason is not null and length(trim(reason)) > 0))
);
create index review_decisions_submission_idx on academics.review_decisions (submission_id);
create index review_decisions_school_idx on academics.review_decisions (school_id);

create table academics.parent_reviews (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  submission_id uuid not null references academics.assignment_submissions (id) on delete cascade,
  parent_id text not null,
  acknowledged boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  unique (submission_id, parent_id)
);
create index parent_reviews_school_idx on academics.parent_reviews (school_id);

-- +goose StatementBegin
do $$
declare t text;
begin
  foreach t in array array['outbox', 'questions', 'question_options', 'assignments', 'assignment_items',
    'assignment_submissions', 'answers', 'review_decisions', 'parent_reviews']
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
drop table if exists academics.parent_reviews;
drop table if exists academics.review_decisions;
drop table if exists academics.answers;
drop table if exists academics.assignment_submissions;
drop table if exists academics.assignment_items;
drop table if exists academics.assignments;
drop table if exists academics.question_options;
drop table if exists academics.questions;
drop table if exists academics.outbox;
