ALTER TABLE "meetings"
  ADD COLUMN "more_times_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reschedule_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retry_after_noshow_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mentee_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mentor_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "meeting_time_slots"
  ADD COLUMN "is_booked" BOOLEAN NOT NULL DEFAULT false;
