-- Engagement tables (outcomes, feedback, blocklist).
-- meeting_id columns are UUIDs without FK: Dev 2 owns meetings.

CREATE TABLE "meeting_outcome_responses" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "respondent_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "happened" BOOLEAN NOT NULL,
    "absent_party" TEXT,
    "still_want_to_meet" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "meeting_outcome_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedbacks" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "open_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_requests" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "feedback_requested_at" TIMESTAMP(3) NOT NULL,
    "fulfilled_at" TIMESTAMP(3),
    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mentor_mentee_blocks" (
    "id" UUID NOT NULL,
    "mentee_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "meeting_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleared_at" TIMESTAMP(3),
    CONSTRAINT "mentor_mentee_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meeting_outcome_responses_meeting_id_respondent_id_key" ON "meeting_outcome_responses"("meeting_id", "respondent_id");
CREATE INDEX "meeting_outcome_responses_meeting_id_idx" ON "meeting_outcome_responses"("meeting_id");

CREATE UNIQUE INDEX "feedbacks_meeting_id_submitted_by_key" ON "feedbacks"("meeting_id", "submitted_by");
CREATE INDEX "feedbacks_meeting_id_idx" ON "feedbacks"("meeting_id");

CREATE UNIQUE INDEX "feedback_requests_meeting_id_recipient_id_key" ON "feedback_requests"("meeting_id", "recipient_id");
CREATE INDEX "feedback_requests_fulfilled_at_feedback_requested_at_idx" ON "feedback_requests"("fulfilled_at", "feedback_requested_at");

CREATE INDEX "mentor_mentee_blocks_mentee_id_mentor_id_idx" ON "mentor_mentee_blocks"("mentee_id", "mentor_id");
CREATE INDEX "mentor_mentee_blocks_cleared_at_idx" ON "mentor_mentee_blocks"("cleared_at");

ALTER TABLE "meeting_outcome_responses" ADD CONSTRAINT "meeting_outcome_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentor_mentee_blocks" ADD CONSTRAINT "mentor_mentee_blocks_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentor_mentee_blocks" ADD CONSTRAINT "mentor_mentee_blocks_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
