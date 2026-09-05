-- Reconcile databases whose migration history says the activity migration ran,
-- but whose users table is still missing the columns used by the API.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletion_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletion_scheduled_at" TIMESTAMP(3);
