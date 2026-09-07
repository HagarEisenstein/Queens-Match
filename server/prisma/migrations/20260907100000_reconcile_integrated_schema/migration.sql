-- Reconcile schema objects referenced by the meeting/calendar branches but
-- absent from their checked-in migration histories. Statements are idempotent
-- so databases that received an equivalent manual hotfix remain deployable.

CREATE TABLE IF NOT EXISTS "availability_blocks" (
  "id" UUID NOT NULL,
  "mentor_id" UUID NOT NULL,
  "meeting_id" UUID NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "is_booked" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "availability_blocks_meeting_id_idx"
  ON "availability_blocks"("meeting_id");
CREATE INDEX IF NOT EXISTS "availability_blocks_mentor_id_idx"
  ON "availability_blocks"("mentor_id");

CREATE INDEX IF NOT EXISTS "meetings_mentee_id_idx" ON "meetings"("mentee_id");
CREATE INDEX IF NOT EXISTS "meetings_mentor_id_idx" ON "meetings"("mentor_id");
CREATE INDEX IF NOT EXISTS "meetings_scheduled_time_idx" ON "meetings"("scheduled_time");
CREATE INDEX IF NOT EXISTS "meetings_status_idx" ON "meetings"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'availability_blocks_meeting_id_fkey'
  ) THEN
    ALTER TABLE "availability_blocks"
      ADD CONSTRAINT "availability_blocks_meeting_id_fkey"
      FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'availability_blocks_mentor_id_fkey'
  ) THEN
    ALTER TABLE "availability_blocks"
      ADD CONSTRAINT "availability_blocks_mentor_id_fkey"
      FOREIGN KEY ("mentor_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
