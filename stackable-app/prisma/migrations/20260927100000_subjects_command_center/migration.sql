-- Subjects command center: assessments, curriculum, class progress, resources.
-- ADDITIVE ONLY. Plain PostgreSQL (no Supabase RLS/policies, no auth.* functions, no triggers).
-- Ported from db/subjects-command-center.sql, which only ever existed in the legacy Supabase
-- project. Every statement is idempotent (IF NOT EXISTS) so re-running it is harmless.
--
-- Not ported on purpose: `school_subjects.is_active` (the app reads `subjects.is_active`;
-- `school_subjects.status` already exists). `updated_at` already exists on school_subjects.

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "school_subject_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "term" TEXT,
    "total_marks_raw" DECIMAL(6,2),
    "duration_minutes" INTEGER,
    "scheduled_start_at" TIMESTAMPTZ(6),
    "scheduled_end_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessments_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "assessments_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "assessments_type_check" CHECK ("type" IN ('cat', 'exam', 'rat', 'quiz')),
    CONSTRAINT "assessments_status_check" CHECK ("status" IN ('draft', 'scheduled', 'in_progress', 'completed', 'published', 'cancelled')),
    CONSTRAINT "assessments_duration_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
    CONSTRAINT "assessments_schedule_check" CHECK ("scheduled_end_at" IS NULL OR "scheduled_start_at" IS NULL OR "scheduled_end_at" >= "scheduled_start_at")
);

CREATE INDEX IF NOT EXISTS "idx_assessments_school_term" ON "assessments"("school_id", "term");
CREATE INDEX IF NOT EXISTS "idx_assessments_school_subject_start" ON "assessments"("school_subject_id", "scheduled_start_at" DESC);

-- ---------------------------------------------------------------------------
-- assessment_targets (one row per class an assessment is aimed at)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "assessment_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_id" UUID NOT NULL,
    "school_subject_class_id" UUID,
    "class_id" UUID NOT NULL,
    "teacher_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "linger_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_targets_unique" UNIQUE ("assessment_id", "class_id"),
    CONSTRAINT "assessment_targets_assessment_fk" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "assessment_targets_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "assessment_targets_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "assessment_targets_teacher_fk" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "assessment_targets_status_check" CHECK ("status" IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'published')),
    CONSTRAINT "assessment_targets_time_check" CHECK ("completed_at" IS NULL OR "started_at" IS NULL OR "completed_at" >= "started_at")
);

CREATE INDEX IF NOT EXISTS "idx_assessment_targets_assessment_status" ON "assessment_targets"("assessment_id", "status");
CREATE INDEX IF NOT EXISTS "idx_assessment_targets_school_subject_class" ON "assessment_targets"("school_subject_class_id");

-- ---------------------------------------------------------------------------
-- assessment_results (one row per student per target)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "assessment_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "assessment_target_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "raw_score" DECIMAL(6,2),
    "normalized_pct" DECIMAL(6,2),
    "grade" TEXT,
    "remarks" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessment_results_unique" UNIQUE ("assessment_target_id", "student_id"),
    CONSTRAINT "assessment_results_target_fk" FOREIGN KEY ("assessment_target_id") REFERENCES "assessment_targets"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "assessment_results_student_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_assessment_results_target_published" ON "assessment_results"("assessment_target_id", "published_at");
CREATE INDEX IF NOT EXISTS "idx_assessment_results_student" ON "assessment_results"("student_id");

-- ---------------------------------------------------------------------------
-- subject_curriculum_nodes (topic tree per class offering)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subject_curriculum_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_class_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL,
    "node_type" TEXT NOT NULL DEFAULT 'topic',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_curriculum_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subject_curriculum_nodes_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_curriculum_nodes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "subject_curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_curriculum_nodes_type_check" CHECK ("node_type" IN ('topic', 'subtopic', 'subtopic_item')),
    CONSTRAINT "subject_curriculum_nodes_depth_check" CHECK ("depth" >= 0),
    CONSTRAINT "subject_curriculum_nodes_sort_order_check" CHECK ("sort_order" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_subject_curriculum_nodes_class_parent" ON "subject_curriculum_nodes"("school_subject_class_id", "parent_id", "sort_order");

-- ---------------------------------------------------------------------------
-- subject_curriculum_progress (per-topic completion for a class offering)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subject_curriculum_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_class_id" UUID NOT NULL,
    "curriculum_node_id" UUID NOT NULL,
    "completion_state" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_curriculum_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subject_curriculum_progress_unique" UNIQUE ("school_subject_class_id", "curriculum_node_id"),
    CONSTRAINT "subject_curriculum_progress_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_curriculum_progress_node_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "subject_curriculum_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_curriculum_progress_state_check" CHECK ("completion_state" IN ('pending', 'partial', 'complete'))
);

CREATE INDEX IF NOT EXISTS "idx_subject_curriculum_progress_class_state" ON "subject_curriculum_progress"("school_subject_class_id", "completion_state");

-- ---------------------------------------------------------------------------
-- subject_class_progress (current topic + % of syllabus covered, one row per class offering)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subject_class_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_class_id" UUID NOT NULL,
    "current_node_id" UUID,
    "syllabus_progress_pct" DECIMAL(5,2) DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_class_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subject_class_progress_unique" UNIQUE ("school_subject_class_id"),
    CONSTRAINT "subject_class_progress_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_class_progress_current_node_fk" FOREIGN KEY ("current_node_id") REFERENCES "subject_curriculum_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "subject_class_progress_pct_check" CHECK ("syllabus_progress_pct" IS NULL OR ("syllabus_progress_pct" >= 0 AND "syllabus_progress_pct" <= 100))
);

-- ---------------------------------------------------------------------------
-- subject_resources (uploaded files and links per class offering)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subject_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_class_id" UUID NOT NULL,
    "curriculum_node_id" UUID,
    "resource_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "short_description" TEXT,
    "author_name" TEXT,
    "cover_image_url" TEXT,
    "storage_path" TEXT,
    "source_url" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "uploaded_by" UUID,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_resources_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subject_resources_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_resources_node_fk" FOREIGN KEY ("curriculum_node_id") REFERENCES "subject_curriculum_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
    CONSTRAINT "subject_resources_type_check" CHECK ("resource_type" IN ('video', 'document', 'book', 'link', 'audio')),
    CONSTRAINT "subject_resources_visibility_check" CHECK ("visibility" IN ('private', 'public')),
    CONSTRAINT "subject_resources_source_check" CHECK ("storage_path" IS NOT NULL OR "source_url" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS "idx_subject_resources_class_type" ON "subject_resources"("school_subject_class_id", "resource_type");
CREATE INDEX IF NOT EXISTS "idx_subject_resources_visibility" ON "subject_resources"("visibility");
-- New (not in the Supabase SQL): the download proxy looks a file up by its storage path.
CREATE INDEX IF NOT EXISTS "idx_subject_resources_storage_path" ON "subject_resources"("storage_path");

-- ---------------------------------------------------------------------------
-- subject_resource_visibility_events (history of private/public switches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subject_resource_visibility_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "previous_visibility" TEXT NOT NULL,
    "next_visibility" TEXT NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_resource_visibility_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subject_resource_visibility_events_resource_fk" FOREIGN KEY ("resource_id") REFERENCES "subject_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "subject_resource_visibility_events_previous_check" CHECK ("previous_visibility" IN ('private', 'public')),
    CONSTRAINT "subject_resource_visibility_events_next_check" CHECK ("next_visibility" IN ('private', 'public'))
);

CREATE INDEX IF NOT EXISTS "idx_subject_resource_visibility_events_resource" ON "subject_resource_visibility_events"("resource_id", "changed_at" DESC);

-- ---------------------------------------------------------------------------
-- Helpful indexes on existing tables (the old SQL added them in Supabase)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_grading_reports_subject_class_term" ON "grading_reports"("subject_id", "class_id", "term");
CREATE INDEX IF NOT EXISTS "idx_grading_reports_student_subject_term" ON "grading_reports"("student_id", "subject_id", "term");
CREATE INDEX IF NOT EXISTS "idx_teacher_subjects_school_role" ON "teacher_subjects"("school_id", "assignment_role");
CREATE INDEX IF NOT EXISTS "idx_student_subjects_school_subject_active" ON "student_subjects"("school_subject_id", "is_active");
