-- +goose Up
create table academics.grading_systems (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  name text not null,
  effective_from timestamptz not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index grading_systems_school_idx on academics.grading_systems (school_id);
create unique index grading_systems_one_active_idx on academics.grading_systems (school_id) where active;

create table academics.grade_bands (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  system_id uuid not null references academics.grading_systems (id) on delete cascade,
  min_pct double precision not null check (min_pct >= 0),
  max_pct double precision not null check (max_pct <= 100),
  grade text not null,
  points double precision not null,
  remark text,
  created_at timestamptz not null default now(),
  check (min_pct <= max_pct)
);
create index grade_bands_system_idx on academics.grade_bands (system_id);
create index grade_bands_school_idx on academics.grade_bands (school_id);

create table academics.pass_marks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  system_id uuid not null references academics.grading_systems (id) on delete cascade,
  subject_id text, -- null is the default pass mark
  pass_pct double precision not null check (pass_pct between 0 and 100),
  created_at timestamptz not null default now()
);
create unique index pass_marks_default_idx on academics.pass_marks (system_id) where subject_id is null;
create unique index pass_marks_subject_idx on academics.pass_marks (system_id, subject_id) where subject_id is not null;
create index pass_marks_school_idx on academics.pass_marks (school_id);

create table academics.assessment_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_id uuid not null references academics.assessments (id) on delete cascade,
  student_id text not null,
  attempt_id uuid not null references academics.attempts (id),
  system_id uuid not null references academics.grading_systems (id), -- old results keep their system
  raw double precision not null check (raw >= 0),
  total double precision not null check (total > 0),
  pct double precision not null check (pct between 0 and 100),
  grade text not null,
  points double precision not null,
  remark text,
  is_pass boolean not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);
create index assessment_results_attempt_idx on academics.assessment_results (attempt_id);
create index assessment_results_system_idx on academics.assessment_results (system_id);
create index assessment_results_student_idx on academics.assessment_results (student_id);
create index assessment_results_school_idx on academics.assessment_results (school_id);

-- +goose StatementBegin
do $$
declare t text;
begin
  foreach t in array array['grading_systems', 'grade_bands', 'pass_marks', 'assessment_results']
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
drop table if exists academics.assessment_results;
drop table if exists academics.pass_marks;
drop table if exists academics.grade_bands;
drop table if exists academics.grading_systems;
