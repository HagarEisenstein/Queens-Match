-- Reconcile databases that have the migration records but are missing columns
-- used by the current Prisma client. This migration is intentionally idempotent.
ALTER TABLE "mentor_profiles"
  ADD COLUMN IF NOT EXISTS "max_meetings" INTEGER,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "more_times_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reschedule_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "retry_after_noshow_used" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mentee_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mentor_arrival_confirmed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletion_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletion_scheduled_at" TIMESTAMP(3);

ALTER TABLE "notification_deliveries"
  ADD COLUMN IF NOT EXISTS "locked_at" TIMESTAMP(3);
