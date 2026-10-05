-- H6: broken defaults. Phone BigInt -> text is NOT done here (app code and ambiguous values; see report).

-- UP
-- schools.status default was the literal text 'pending::text' (quotes included).
ALTER TABLE "schools" ALTER COLUMN "status" SET DEFAULT 'pending';
UPDATE "schools" SET "status" = 'pending' WHERE "status" IN ('''pending::text''', 'pending::text');

-- students names defaulted to the string 'NULL'. last_name is NOT NULL, so only its default is removed.
ALTER TABLE "students" ALTER COLUMN "first_name" DROP DEFAULT;
ALTER TABLE "students" ALTER COLUMN "last_name" DROP DEFAULT;
UPDATE "students" SET "first_name" = NULL WHERE "first_name" = 'NULL';

-- DOWN
-- ALTER TABLE "schools" ALTER COLUMN "status" SET DEFAULT '''pending::text''';
-- ALTER TABLE "students" ALTER COLUMN "first_name" SET DEFAULT 'NULL';
-- ALTER TABLE "students" ALTER COLUMN "last_name" SET DEFAULT 'NULL';
-- (row fixes are not reverted: the old values were invalid)
