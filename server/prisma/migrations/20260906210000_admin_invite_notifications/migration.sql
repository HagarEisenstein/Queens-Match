ALTER TABLE "notifications"
ADD COLUMN "status" TEXT,
ADD COLUMN "metadata" JSONB;

CREATE INDEX "notifications_type_status_created_at_idx"
ON "notifications"("type", "status", "created_at");
