-- H16: RLS foundation. Pilot table: students. FORCE ROW LEVEL SECURITY is intentionally OFF so the
-- table owner (the current app connection) keeps working. Tenant = schools.id via app.school_id.

-- UP
CREATE SCHEMA IF NOT EXISTS app;

-- Fails closed: unset or empty setting gives NULL, so no rows match. A malformed uuid raises an error.
CREATE OR REPLACE FUNCTION app.current_school_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.school_id', true), '')::uuid $$;

-- Non-bypass application role. NOLOGIN until cutover: ALTER ROLE stackable_app LOGIN PASSWORD '...'.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stackable_app') THEN
    CREATE ROLE stackable_app NOLOGIN NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO stackable_app;
GRANT EXECUTE ON FUNCTION app.current_school_id() TO stackable_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stackable_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stackable_app;

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "students_tenant_isolation" ON "students";
CREATE POLICY "students_tenant_isolation" ON "students"
  USING ("school_id" = app.current_school_id())
  WITH CHECK ("school_id" = app.current_school_id());

-- DOWN
-- DROP POLICY IF EXISTS "students_tenant_isolation" ON "students";
-- ALTER TABLE "students" DISABLE ROW LEVEL SECURITY;
-- REVOKE ALL ON ALL TABLES IN SCHEMA public FROM stackable_app;
-- REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM stackable_app;
-- REVOKE ALL ON SCHEMA public, app FROM stackable_app;
-- DROP FUNCTION IF EXISTS app.current_school_id();
-- DROP ROLE IF EXISTS stackable_app;
-- DROP SCHEMA IF EXISTS app;
