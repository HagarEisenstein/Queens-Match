-- Epic 2: make notification delivery claims recoverable across worker restarts.
ALTER TABLE "notification_deliveries"
  ADD COLUMN "locked_at" TIMESTAMP(3);

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_status_valid_check"
  CHECK ("status" IN ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'FAILED'));

CREATE INDEX "notification_deliveries_processing_lease_idx"
  ON "notification_deliveries"("status", "locked_at");
