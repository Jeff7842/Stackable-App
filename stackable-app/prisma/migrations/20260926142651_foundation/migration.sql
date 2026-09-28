-- Foundation migration (Neon / Prisma).
--
-- Generated with `prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma --script` against the live Neon database, so it is purely
-- additive: 1 ALTER TABLE ADD COLUMN, 3 CREATE TABLE, indexes, and foreign keys
-- on the NEW tables only. Nothing is dropped, renamed or retyped.
--
-- Equivalent in effect to db/foundation.sql, which is the hand-run version for the
-- legacy Supabase database.
--
-- Row level security is intentionally NOT enabled here: none of the existing Neon
-- tables have it (pg_class.relrowsecurity = false everywhere) and Neon has no
-- anon/authenticated roles. The app reaches Neon only server-side as the owner
-- role, so RLS adds nothing on this database. (On Supabase the browser holds the
-- anon key, which is why db/foundation.sql DOES enable RLS on these tables.)

-- AlterTable
ALTER TABLE "user_otps" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'login';

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "reset_token_hash" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "school_id" UUID,
    "actor_user_id" UUID NOT NULL,
    "target_user_id" UUID,
    "action" TEXT NOT NULL,
    "method" TEXT,
    "path" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "actor_session_id" UUID,
    "target_user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_password_resets_reset_token_hash" ON "password_resets"("reset_token_hash");

-- CreateIndex
CREATE INDEX "idx_password_resets_user_id_created_at" ON "password_resets"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor_user_id" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_school_id" ON "audit_logs"("school_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_target_user_id" ON "audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "idx_impersonation_sessions_actor_user_id" ON "impersonation_sessions"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_impersonation_sessions_target_user_id" ON "impersonation_sessions"("target_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_impersonation_sessions_token_hash" ON "impersonation_sessions"("token_hash");

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_user_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_session_fk" FOREIGN KEY ("actor_session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_fk" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
