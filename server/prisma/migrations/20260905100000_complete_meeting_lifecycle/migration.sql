ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "more_times_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reschedule_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "retry_after_noshow_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mentee_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mentor_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "meeting_time_slots"
  ADD COLUMN IF NOT EXISTS "is_booked" BOOLEAN NOT NULL DEFAULT false;
