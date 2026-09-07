ALTER TABLE "mentor_profiles"
  ADD COLUMN "max_meetings" INTEGER,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
