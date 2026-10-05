-- H3/H7: CHECK constraints for roles and statuses (NOT VALID, then VALIDATE).

-- UP
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "ck_users_role";
ALTER TABLE "users" ADD CONSTRAINT "ck_users_role" CHECK ("role" IN
  ('super-admin','admin','manager','teacher','staff','student','pupil','parent',
   'finance','secretary','driver','dept-head')) NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "ck_users_role";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "ck_users_status";
ALTER TABLE "users" ADD CONSTRAINT "ck_users_status" CHECK ("status" IN ('pending','active','suspended')) NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "ck_users_status";

ALTER TABLE "schools" DROP CONSTRAINT IF EXISTS "ck_schools_status";
ALTER TABLE "schools" ADD CONSTRAINT "ck_schools_status" CHECK ("status" IN ('pending','active','suspended')) NOT VALID;
ALTER TABLE "schools" VALIDATE CONSTRAINT "ck_schools_status";

-- DOWN
-- ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "ck_users_role", DROP CONSTRAINT IF EXISTS "ck_users_status";
-- ALTER TABLE "schools" DROP CONSTRAINT IF EXISTS "ck_schools_status";
