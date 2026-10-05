-- Baseline the Better Auth tables (created originally by `prisma db push`).
-- Idempotent: safe on the live DB where they already exist, and builds them on a fresh DB.

-- UP
CREATE TABLE IF NOT EXISTS "ba_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolId" UUID,
    "role" TEXT,
    "schoolCode" TEXT,
    "status" TEXT DEFAULT 'active',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ba_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ba_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ba_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ba_sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ba_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ba_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ba_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ba_two_factors" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ba_two_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ba_users_email_key" ON "ba_users"("email");
CREATE INDEX IF NOT EXISTS "idx_ba_sessions_token" ON "ba_sessions"("token");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ba_accounts_userId_fkey') THEN
    ALTER TABLE "ba_accounts" ADD CONSTRAINT "ba_accounts_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ba_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ba_sessions_userId_fkey') THEN
    ALTER TABLE "ba_sessions" ADD CONSTRAINT "ba_sessions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ba_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ba_two_factors_userId_fkey') THEN
    ALTER TABLE "ba_two_factors" ADD CONSTRAINT "ba_two_factors_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "ba_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DOWN (manual; destroys all Better Auth identities, only run on a DB built from this migration)
-- DROP TABLE IF EXISTS "ba_two_factors", "ba_sessions", "ba_accounts", "ba_verifications", "ba_users";
