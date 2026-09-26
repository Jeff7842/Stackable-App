-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_type" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "school_no" BIGINT NOT NULL,
    "clock_in" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clock_out" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'present',
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_code" TEXT NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_attendance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "students_present" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_subject_performance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "class_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "average_score" DECIMAL(5,2),
    "average_grade" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "school_subject_id" UUID,

    CONSTRAINT "class_subject_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "class_name" TEXT NOT NULL,
    "stream" TEXT,
    "class_teacher_id" UUID,
    "class_prefect_id" UUID,
    "total_students" INTEGER DEFAULT 0,
    "students_present_today" INTEGER DEFAULT 0,
    "position_in_stream" INTEGER,
    "position_overall" INTEGER,
    "class_performance" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "teacher_id" UUID,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "term" TEXT NOT NULL,
    "class_id" UUID NOT NULL,
    "grade" TEXT NOT NULL,
    "teacher_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "school_subject_id" UUID,
    "raw_score" DECIMAL(6,2),
    "normalized_pct" DECIMAL(6,2),
    "remarks" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "phone" BIGINT NOT NULL,
    "alternate_phone" TEXT,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_profiles" (
    "school_id" UUID NOT NULL,
    "head_name" TEXT,
    "owner_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT NOT NULL DEFAULT 'EMPTY',

    CONSTRAINT "school_profiles_pkey" PRIMARY KEY ("school_id")
);

-- CreateTable
CREATE TABLE "school_security_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "code_label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "school_security_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_subject_classes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_subject_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_subject_teacher_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_subject_id" UUID NOT NULL,
    "school_subject_class_id" UUID,
    "teacher_id" UUID NOT NULL,
    "assignment_role" TEXT NOT NULL DEFAULT 'teacher',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_subject_teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "school_subject_seq" INTEGER NOT NULL,
    "custom_subject_code" VARCHAR(7) NOT NULL,
    "local_subject_name" TEXT,
    "local_short_name" TEXT,
    "strapline" VARCHAR(120),
    "description" TEXT,
    "abstract_image_url" TEXT,
    "theme_token" TEXT,
    "hod_teacher_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "is_core" BOOLEAN NOT NULL DEFAULT true,
    "is_elective" BOOLEAN NOT NULL DEFAULT false,
    "requires_lab" BOOLEAN NOT NULL DEFAULT false,
    "pass_mark" DECIMAL(5,2) DEFAULT 40.00,
    "ranking_weight" DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    "weekly_lessons" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "no" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '''pending::text''',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "email" TEXT,
    "phone_1" BIGINT NOT NULL,
    "phone_2" BIGINT,
    "phone_3" BIGINT,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" BIGINT NOT NULL,
    "logo" TEXT,
    "late_time" TIME(6) DEFAULT '08:30:00'::time without time zone,
    "subscription_package" TEXT NOT NULL DEFAULT 'Seedling',
    "subscription_status" TEXT NOT NULL DEFAULT 'inactive',
    "subscription_started_at" TIMESTAMPTZ(6),
    "subscription_expires_at" TIMESTAMPTZ(6),
    "expected_users" INTEGER NOT NULL DEFAULT 0,
    "expected_teachers" INTEGER NOT NULL DEFAULT 0,
    "expected_admins" INTEGER NOT NULL DEFAULT 0,
    "expected_students" INTEGER NOT NULL DEFAULT 0,
    "expected_parents" INTEGER NOT NULL DEFAULT 0,
    "expected_staff" INTEGER NOT NULL DEFAULT 0,
    "code_change_count" TEXT NOT NULL DEFAULT '0',
    "pending_code_change_at" TIMESTAMPTZ(6),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id","created_at","code","no","school_id")
);

-- CreateTable
CREATE TABLE "student_parents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "student_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "primary_role" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "teacher_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "school_subject_id" UUID,
    "school_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "school_name" TEXT NOT NULL,
    "admission_no" TEXT NOT NULL,
    "class_id" UUID,
    "teacher_id" UUID,
    "date_of_birth" DATE,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "location" TEXT,
    "home_address" TEXT,
    "emergency_contact" TEXT,
    "activity" TEXT,
    "health_status" TEXT,
    "profile_picture" TEXT,
    "average_grade" TEXT,
    "other_info" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_name" TEXT DEFAULT 'NULL',
    "last_name" TEXT NOT NULL DEFAULT 'NULL',
    "class_teacher_id" UUID,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" BIGSERIAL NOT NULL,
    "subject_name" TEXT NOT NULL,
    "subject_code" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "acronym" VARCHAR(3),
    "short_name" TEXT,
    "strapline" VARCHAR(120),
    "description" TEXT,
    "department" TEXT,
    "category" TEXT NOT NULL DEFAULT 'core',
    "subject_type" TEXT NOT NULL DEFAULT 'general',
    "education_level" TEXT NOT NULL DEFAULT 'secondary',
    "requires_lab" BOOLEAN NOT NULL DEFAULT false,
    "has_coursework" BOOLEAN NOT NULL DEFAULT true,
    "has_assessments" BOOLEAN NOT NULL DEFAULT true,
    "is_elective" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_sequence" INTEGER,
    "theme_token" TEXT,
    "abstract_image_url" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_student_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "subject_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "class_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,

    CONSTRAINT "teacher_student_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_subjects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_id" UUID NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "school_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "school_subject_id" UUID,
    "assignment_role" TEXT NOT NULL DEFAULT 'teacher',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_timetables" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teacher_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "class_id" UUID,
    "subject_id" BIGINT,
    "room" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "item_type" TEXT DEFAULT 'class',
    "title" TEXT,
    "notes" TEXT,

    CONSTRAINT "teacher_timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "admission_number" TEXT NOT NULL,
    "subject_id" BIGINT,
    "school_id" UUID NOT NULL,
    "profile_photo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "days_present" INTEGER NOT NULL DEFAULT 0,
    "total_school_days" INTEGER NOT NULL DEFAULT 70,
    "attendance_percentage" DECIMAL,
    "class_teacher" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_code" TEXT NOT NULL,
    "otp_code" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "user_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_page_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "page_key" TEXT NOT NULL,
    "can_access" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_page_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "session_type" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "school_id" UUID NOT NULL,
    "school_code" TEXT NOT NULL DEFAULT '',
    "school_adm" BIGINT,
    "email" TEXT,
    "phone" BIGINT,
    "phone_2" BIGINT,
    "password_hash" TEXT,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_reference_code_key" ON "attendance"("reference_code");

-- CreateIndex
CREATE INDEX "idx_attendance_clock_in" ON "attendance"("clock_in");

-- CreateIndex
CREATE INDEX "idx_attendance_school_id" ON "attendance"("school_id");

-- CreateIndex
CREATE INDEX "idx_attendance_user_id" ON "attendance"("user_id");

-- CreateIndex
CREATE INDEX "idx_attendance_user_type" ON "attendance"("user_type");

-- CreateIndex
CREATE UNIQUE INDEX "class_date_unique" ON "class_attendance"("class_id", "date");

-- CreateIndex
CREATE INDEX "idx_class_subject_performance_school_subject_id" ON "class_subject_performance"("school_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_subject_unique" ON "class_subject_performance"("class_id", "subject_id");

-- CreateIndex
CREATE INDEX "idx_grading_reports_school_subject_id" ON "grading_reports"("school_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_user_id_key" ON "parent"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parents_phone_school_unique" ON "parent"("school_id", "phone");

-- CreateIndex
CREATE INDEX "idx_school_security_codes_school_id" ON "school_security_codes"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_school_security_code_label" ON "school_security_codes"("school_id", "code_label");

-- CreateIndex
CREATE INDEX "idx_school_subject_classes_class_id" ON "school_subject_classes"("class_id");

-- CreateIndex
CREATE INDEX "idx_school_subject_classes_school_subject_id" ON "school_subject_classes"("school_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_subject_classes_unique" ON "school_subject_classes"("school_subject_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_school_subject_teacher_assignments_school_subject_id" ON "school_subject_teacher_assignments"("school_subject_id");

-- CreateIndex
CREATE INDEX "idx_school_subject_teacher_assignments_teacher_id" ON "school_subject_teacher_assignments"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_subject_teacher_assignments_unique" ON "school_subject_teacher_assignments"("school_subject_id", "school_subject_class_id", "teacher_id", "assignment_role");

-- CreateIndex
CREATE UNIQUE INDEX "school_subjects_custom_subject_code_key" ON "school_subjects"("custom_subject_code");

-- CreateIndex
CREATE INDEX "idx_school_subjects_hod_teacher_id" ON "school_subjects"("hod_teacher_id");

-- CreateIndex
CREATE INDEX "idx_school_subjects_school_id" ON "school_subjects"("school_id");

-- CreateIndex
CREATE INDEX "idx_school_subjects_status" ON "school_subjects"("status");

-- CreateIndex
CREATE INDEX "idx_school_subjects_subject_id" ON "school_subjects"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_subjects_unique_school_seq" ON "school_subjects"("school_id", "school_subject_seq");

-- CreateIndex
CREATE UNIQUE INDEX "school_subjects_unique_school_subject" ON "school_subjects"("school_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "schools_school_id_key" ON "schools"("no");

-- CreateIndex
CREATE UNIQUE INDEX "schools_name_key" ON "schools"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schools_id_key" ON "schools"("id");

-- CreateIndex
CREATE INDEX "idx_schools_subscription_expires_at" ON "schools"("subscription_expires_at");

-- CreateIndex
CREATE INDEX "idx_schools_subscription_package" ON "schools"("subscription_package");

-- CreateIndex
CREATE INDEX "idx_schools_subscription_status" ON "schools"("subscription_status");

-- CreateIndex
CREATE UNIQUE INDEX "max_two_primary_parents_per_student" ON "student_parents"("student_id", "is_primary") WHERE (is_primary = true);

-- CreateIndex
CREATE UNIQUE INDEX "sp_unique" ON "student_parents"("student_id", "parent_id");

-- CreateIndex
CREATE INDEX "idx_student_subjects_school_id" ON "student_subjects"("school_id");

-- CreateIndex
CREATE INDEX "idx_student_subjects_school_subject_id" ON "student_subjects"("school_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_subject_unique" ON "student_subjects"("student_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE INDEX "idx_students_class_id" ON "students"("class_id");

-- CreateIndex
CREATE INDEX "idx_students_name" ON "students"("first_name", "last_name");

-- CreateIndex
CREATE INDEX "idx_students_phone" ON "students"("phone");

-- CreateIndex
CREATE INDEX "idx_students_school_class" ON "students"("school_id", "class_id");

-- CreateIndex
CREATE INDEX "idx_students_school_id" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "idx_students_status" ON "students"("status");

-- CreateIndex
CREATE INDEX "idx_students_teacher_id" ON "students"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_school_adm_unique" ON "students"("school_id", "admission_no");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_name_key" ON "subjects"("subject_name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_subject_code_key" ON "subjects"("subject_code");

-- CreateIndex
CREATE INDEX "idx_subjects_category" ON "subjects"("category");

-- CreateIndex
CREATE INDEX "idx_subjects_default_sequence" ON "subjects"("default_sequence");

-- CreateIndex
CREATE INDEX "idx_subjects_department" ON "subjects"("department");

-- CreateIndex
CREATE INDEX "idx_subjects_is_active" ON "subjects"("is_active");

-- CreateIndex
CREATE INDEX "idx_subjects_subject_type" ON "subjects"("subject_type");

-- CreateIndex
CREATE INDEX "idx_teacher_subjects_school_subject_id" ON "teacher_subjects"("school_subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_unique" ON "teacher_subjects"("teacher_id", "subject_id", "school_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_admission_number_key" ON "teachers"("admission_number");

-- CreateIndex
CREATE INDEX "idx_user_otps_expires_at" ON "user_otps"("expires_at");

-- CreateIndex
CREATE INDEX "idx_user_otps_lookup" ON "user_otps"("user_id", "school_code", "otp_code", "consumed_at", "expires_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_user_otps_school_code" ON "user_otps"("school_code");

-- CreateIndex
CREATE INDEX "idx_user_otps_user_id" ON "user_otps"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_page_permissions_user_id" ON "user_page_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_page_permissions_user_page_unique" ON "user_page_permissions"("user_id", "page_key");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_school_unique" ON "users"("school_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_school_unique" ON "users"("school_id", "phone");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_attendance" ADD CONSTRAINT "attendance_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_subject_performance" ADD CONSTRAINT "class_perf_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_subject_performance" ADD CONSTRAINT "class_perf_subject_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "class_subject_performance" ADD CONSTRAINT "class_subject_performance_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grading_reports" ADD CONSTRAINT "fk_gr_class" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grading_reports" ADD CONSTRAINT "fk_gr_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grading_reports" ADD CONSTRAINT "fk_gr_teacher" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "grading_reports" ADD CONSTRAINT "grading_reports_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "name_school_fk" FOREIGN KEY ("school_name") REFERENCES "schools"("name") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parents_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parents_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_profiles" ADD CONSTRAINT "school_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_security_codes" ADD CONSTRAINT "school_security_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_security_codes" ADD CONSTRAINT "school_security_codes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subject_classes" ADD CONSTRAINT "school_subject_classes_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subject_classes" ADD CONSTRAINT "school_subject_classes_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_school_subject_class_fk" FOREIGN KEY ("school_subject_class_id") REFERENCES "school_subject_classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subject_teacher_assignments" ADD CONSTRAINT "school_subject_teacher_assignments_teacher_fk" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_hod_teacher_fk" FOREIGN KEY ("hod_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "school_subjects" ADD CONSTRAINT "school_subjects_subject_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "sp_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "parent"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "sp_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_parents" ADD CONSTRAINT "sp_school_name_fk" FOREIGN KEY ("school_name") REFERENCES "schools"("name") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_subjects" ADD CONSTRAINT "fk_subject" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_subjects" ADD CONSTRAINT "student_subjects_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "name_school_fk" FOREIGN KEY ("school_name") REFERENCES "schools"("name") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_class_teacher_id_fkey" FOREIGN KEY ("class_teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_student_assignments" ADD CONSTRAINT "teacher_student_assignments_class_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_student_assignments" ADD CONSTRAINT "teacher_student_assignments_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_student_assignments" ADD CONSTRAINT "teacher_student_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_student_assignments" ADD CONSTRAINT "teacher_student_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_student_assignments" ADD CONSTRAINT "teacher_student_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_school_subject_fk" FOREIGN KEY ("school_subject_id") REFERENCES "school_subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_timetables" ADD CONSTRAINT "teacher_timetables_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_timetables" ADD CONSTRAINT "teacher_timetables_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teacher_timetables" ADD CONSTRAINT "teacher_timetables_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_subject_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_otps" ADD CONSTRAINT "user_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_page_permissions" ADD CONSTRAINT "user_page_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
