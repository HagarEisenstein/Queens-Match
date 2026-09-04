-- Epic 3: meeting coordination state machine.

CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "mentee_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_mentor_times',
    "scheduled_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meeting_time_slots" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_time_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meetings_mentor_id_status_idx" ON "meetings"("mentor_id", "status");
CREATE INDEX "meetings_mentee_id_status_idx" ON "meetings"("mentee_id", "status");
CREATE INDEX "meeting_time_slots_meeting_id_idx" ON "meeting_time_slots"("meeting_id");

ALTER TABLE "meetings" ADD CONSTRAINT "meetings_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_time_slots" ADD CONSTRAINT "meeting_time_slots_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
