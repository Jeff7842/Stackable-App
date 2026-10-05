-- H5: schools had a 5-column composite PK (id, created_at, code, no, school_id). Tenant key is id.
-- Reuses the existing unique index schools_id_key, so every FK to schools(id) keeps working.

-- UP
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.schools'::regclass AND conname = 'schools_pkey' AND cardinality(conkey) > 1
  ) THEN
    ALTER TABLE "schools" DROP CONSTRAINT "schools_pkey";
    ALTER TABLE "schools" ADD CONSTRAINT "schools_pkey" PRIMARY KEY USING INDEX "schools_id_key";
  END IF;
END $$;

-- DOWN (PK(id) is stricter than the old PK and FKs depend on its index, so keep it and only
-- restore the old uniqueness rule)
-- ALTER TABLE "schools" ADD CONSTRAINT "schools_composite_old_key" UNIQUE ("id", "created_at", "code", "no", "school_id");
