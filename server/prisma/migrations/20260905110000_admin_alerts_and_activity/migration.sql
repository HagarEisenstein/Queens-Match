ALTER TABLE "users"
  ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletion_warning_sent_at" TIMESTAMP(3),
  ADD COLUMN "deletion_scheduled_at" TIMESTAMP(3);

CREATE TABLE "admin_alerts" (
  "idempotency_key" TEXT NOT NULL,
  "alert_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "meeting_id" UUID,
  "subject_user_id" UUID,
  "payload" JSONB NOT NULL,
  "reviewed_by" UUID,
  "review_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("idempotency_key")
);

CREATE INDEX "admin_alerts_status_created_at_idx" ON "admin_alerts"("status", "created_at");
CREATE INDEX "admin_alerts_alert_type_created_at_idx" ON "admin_alerts"("alert_type", "created_at");
CREATE INDEX "admin_alerts_meeting_id_idx" ON "admin_alerts"("meeting_id");
CREATE INDEX "admin_alerts_subject_user_id_idx" ON "admin_alerts"("subject_user_id");
