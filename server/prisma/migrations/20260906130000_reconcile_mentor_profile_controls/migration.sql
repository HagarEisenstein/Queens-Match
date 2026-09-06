-- Reconcile databases where the mentor profile controls migration is marked
-- applied but one or both columns are missing from the physical table.
ALTER TABLE "mentor_profiles"
  ADD COLUMN IF NOT EXISTS "max_meetings" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
