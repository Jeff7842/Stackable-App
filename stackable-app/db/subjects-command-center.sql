
alter table if exists public.school_subjects
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamp with time zone not null default now();

create index if not exists idx_school_subjects_is_active
  on public.school_subjects using btree (is_active);

create table if not exists public.assessments (
  id uuid not null default gen_random_uuid(),
  school_id uuid not null,
  school_subject_id uuid not null,
  type text not null,
  title text not null,
  description text null,
  term text null,
  total_marks_raw numeric(6, 2) null,
  duration_minutes integer null,
  scheduled_start_at timestamp with time zone null,
  scheduled_end_at timestamp with time zone null,
  status text not null default 'scheduled'::text,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint assessments_pkey primary key (id),
  constraint assessments_school_fk foreign key (school_id) references public.schools (id) on delete cascade,
  constraint assessments_school_subject_fk foreign key (school_subject_id) references public.school_subjects (id) on delete cascade,
  constraint assessments_type_check check (
    type = any (array['cat'::text, 'exam'::text, 'rat'::text, 'quiz'::text])
  ),
  constraint assessments_status_check check (
    status = any (
      array[
        'draft'::text,
        'scheduled'::text,
        'in_progress'::text,
        'completed'::text,
        'published'::text,
        'cancelled'::text
      ]
    )
  ),
  constraint assessments_duration_check check (
    duration_minutes is null or duration_minutes > 0
  ),
  constraint assessments_schedule_check check (
    scheduled_end_at is null or scheduled_start_at is null or scheduled_end_at >= scheduled_start_at
  )
) tablespace pg_default;

create index if not exists idx_assessments_school_subject_start
  on public.assessments using btree (school_subject_id, scheduled_start_at desc);

create index if not exists idx_assessments_school_term
  on public.assessments using btree (school_id, term);

create table if not exists public.assessment_targets (
  id uuid not null default gen_random_uuid(),
  assessment_id uuid not null,
  school_subject_class_id uuid null,
  class_id uuid not null,
  teacher_id uuid null,
  status text not null default 'scheduled'::text,
  started_at timestamp with time zone null,
  completed_at timestamp with time zone null,
  linger_until timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint assessment_targets_pkey primary key (id),
  constraint assessment_targets_unique unique (assessment_id, class_id),
  constraint assessment_targets_assessment_fk foreign key (assessment_id) references public.assessments (id) on delete cascade,
  constraint assessment_targets_school_subject_class_fk foreign key (school_subject_class_id) references public.school_subject_classes (id) on delete set null,
  constraint assessment_targets_class_fk foreign key (class_id) references public.classes (id) on delete cascade,
  constraint assessment_targets_teacher_fk foreign key (teacher_id) references public.teachers (id) on delete set null,
  constraint assessment_targets_status_check check (
    status = any (
      array[
        'scheduled'::text,
        'in_progress'::text,
        'completed'::text,
        'cancelled'::text,
        'published'::text
      ]
    )
  ),
  constraint assessment_targets_time_check check (
    completed_at is null or started_at is null or completed_at >= started_at
  )
) tablespace pg_default;

create index if not exists idx_assessment_targets_assessment_status
  on public.assessment_targets using btree (assessment_id, status);

create index if not exists idx_assessment_targets_school_subject_class
  on public.assessment_targets using btree (school_subject_class_id);

create table if not exists public.assessment_results (
  id uuid not null default gen_random_uuid(),
  assessment_target_id uuid not null,
  student_id uuid not null,
  raw_score numeric(6, 2) null,
  normalized_pct numeric(6, 2) null,
  grade text null,
  remarks text null,
  published_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint assessment_results_pkey primary key (id),
  constraint assessment_results_unique unique (assessment_target_id, student_id),
  constraint assessment_results_target_fk foreign key (assessment_target_id) references public.assessment_targets (id) on delete cascade,
  constraint assessment_results_student_fk foreign key (student_id) references public.students (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_assessment_results_target_published
  on public.assessment_results using btree (assessment_target_id, published_at);

create index if not exists idx_assessment_results_student
  on public.assessment_results using btree (student_id);

create table if not exists public.subject_curriculum_nodes (
  id uuid not null default gen_random_uuid(),
  school_subject_class_id uuid not null,
  parent_id uuid null,
  title text not null,
  node_type text not null default 'topic'::text,
  sort_order integer not null default 0,
  depth integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subject_curriculum_nodes_pkey primary key (id),
  constraint subject_curriculum_nodes_school_subject_class_fk foreign key (school_subject_class_id) references public.school_subject_classes (id) on delete cascade,
  constraint subject_curriculum_nodes_parent_fk foreign key (parent_id) references public.subject_curriculum_nodes (id) on delete cascade,
  constraint subject_curriculum_nodes_type_check check (
    node_type = any (array['topic'::text, 'subtopic'::text, 'subtopic_item'::text])
  ),
  constraint subject_curriculum_nodes_depth_check check (depth >= 0),
  constraint subject_curriculum_nodes_sort_order_check check (sort_order >= 0)
) tablespace pg_default;

create index if not exists idx_subject_curriculum_nodes_class_parent
  on public.subject_curriculum_nodes using btree (school_subject_class_id, parent_id, sort_order);

create table if not exists public.subject_curriculum_progress (
  id uuid not null default gen_random_uuid(),
  school_subject_class_id uuid not null,
  curriculum_node_id uuid not null,
  completion_state text not null default 'pending'::text,
  completed_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subject_curriculum_progress_pkey primary key (id),
  constraint subject_curriculum_progress_unique unique (school_subject_class_id, curriculum_node_id),
  constraint subject_curriculum_progress_school_subject_class_fk foreign key (school_subject_class_id) references public.school_subject_classes (id) on delete cascade,
  constraint subject_curriculum_progress_node_fk foreign key (curriculum_node_id) references public.subject_curriculum_nodes (id) on delete cascade,
  constraint subject_curriculum_progress_state_check check (
    completion_state = any (array['pending'::text, 'partial'::text, 'complete'::text])
  )
) tablespace pg_default;

create index if not exists idx_subject_curriculum_progress_class_state
  on public.subject_curriculum_progress using btree (school_subject_class_id, completion_state);

create table if not exists public.subject_class_progress (
  id uuid not null default gen_random_uuid(),
  school_subject_class_id uuid not null,
  current_node_id uuid null,
  syllabus_progress_pct numeric(5, 2) null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint subject_class_progress_pkey primary key (id),
  constraint subject_class_progress_unique unique (school_subject_class_id),
  constraint subject_class_progress_school_subject_class_fk foreign key (school_subject_class_id) references public.school_subject_classes (id) on delete cascade,
  constraint subject_class_progress_current_node_fk foreign key (current_node_id) references public.subject_curriculum_nodes (id) on delete set null,
  constraint subject_class_progress_pct_check check (
    syllabus_progress_pct is null or (syllabus_progress_pct >= 0 and syllabus_progress_pct <= 100)
  )
) tablespace pg_default;

create table if not exists public.subject_resources (
  id uuid not null default gen_random_uuid(),
  school_subject_class_id uuid not null,
  curriculum_node_id uuid null,
  resource_type text not null,
  title text not null,
  short_description text null,
  author_name text null,
  cover_image_url text null,
  storage_path text null,
  source_url text null,
  visibility text not null default 'private'::text,
  uploaded_by uuid null,
  uploaded_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subject_resources_pkey primary key (id),
  constraint subject_resources_school_subject_class_fk foreign key (school_subject_class_id) references public.school_subject_classes (id) on delete cascade,
  constraint subject_resources_node_fk foreign key (curriculum_node_id) references public.subject_curriculum_nodes (id) on delete set null,
  constraint subject_resources_type_check check (
    resource_type = any (
      array[
        'video'::text,
        'document'::text,
        'book'::text,
        'link'::text,
        'audio'::text
      ]
    )
  ),
  constraint subject_resources_visibility_check check (
    visibility = any (array['private'::text, 'public'::text])
  ),
  constraint subject_resources_source_check check (
    storage_path is not null or source_url is not null
  )
) tablespace pg_default;

create index if not exists idx_subject_resources_class_type
  on public.subject_resources using btree (school_subject_class_id, resource_type);

create index if not exists idx_subject_resources_visibility
  on public.subject_resources using btree (visibility);

create table if not exists public.subject_resource_visibility_events (
  id uuid not null default gen_random_uuid(),
  resource_id uuid not null,
  previous_visibility text not null,
  next_visibility text not null,
  changed_by uuid null,
  changed_at timestamp with time zone not null default now(),
  constraint subject_resource_visibility_events_pkey primary key (id),
  constraint subject_resource_visibility_events_resource_fk foreign key (resource_id) references public.subject_resources (id) on delete cascade,
  constraint subject_resource_visibility_events_previous_check check (
    previous_visibility = any (array['private'::text, 'public'::text])
  ),
  constraint subject_resource_visibility_events_next_check check (
    next_visibility = any (array['private'::text, 'public'::text])
  )
) tablespace pg_default;

create index if not exists idx_subject_resource_visibility_events_resource
  on public.subject_resource_visibility_events using btree (resource_id, changed_at desc);

create index if not exists idx_grading_reports_subject_class_term
  on public.grading_reports using btree (subject_id, class_id, term);

create index if not exists idx_grading_reports_student_subject_term
  on public.grading_reports using btree (student_id, subject_id, term);

create index if not exists idx_teacher_subjects_school_role
  on public.teacher_subjects using btree (school_id, assignment_role);

create index if not exists idx_student_subjects_school_subject_active
  on public.student_subjects using btree (school_subject_id, is_active);
