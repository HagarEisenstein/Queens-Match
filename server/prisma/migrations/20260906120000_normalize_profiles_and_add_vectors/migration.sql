-- Epic 1: normalize profile skills and enforce relational data integrity.
-- The pgvector extension is provided by the local pgvector/pgvector image and
-- must also be enabled by the target hosted PostgreSQL instance.
CREATE EXTENSION IF NOT EXISTS vector;

-- Canonicalize legacy free-form arrays before applying database constraints.
UPDATE "users"
SET "roles" = COALESCE(
  (SELECT ARRAY_AGG(DISTINCT LOWER(BTRIM(role)) ORDER BY LOWER(BTRIM(role)))
   FROM UNNEST("roles") AS role
   WHERE BTRIM(role) <> ''),
  ARRAY[]::TEXT[]
);

UPDATE "users"
SET "tech_stack" = COALESCE(
  (SELECT ARRAY_AGG(DISTINCT LOWER(BTRIM(skill)) ORDER BY LOWER(BTRIM(skill)))
   FROM UNNEST("tech_stack") AS skill
   WHERE BTRIM(skill) <> ''),
  ARRAY[]::TEXT[]
);

UPDATE "mentor_profiles"
SET "advice_topics" = COALESCE(
  (SELECT ARRAY_AGG(DISTINCT BTRIM(topic) ORDER BY BTRIM(topic))
   FROM UNNEST("advice_topics") AS topic
   WHERE BTRIM(topic) <> ''),
  ARRAY[]::TEXT[]
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "users"
    WHERE NOT ("roles" <@ ARRAY['mentee', 'mentor', 'admin']::TEXT[])
       OR CARDINALITY("roles") = 0
  ) THEN
    RAISE EXCEPTION 'users.roles contains an unsupported or empty role after normalization';
  END IF;
END $$;

ALTER TABLE "users"
  ADD CONSTRAINT "users_roles_valid_check"
  CHECK ("roles" <@ ARRAY['mentee', 'mentor', 'admin']::TEXT[] AND CARDINALITY("roles") > 0);

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_status_valid_check"
  CHECK ("status" IN (
    'pending_mentor_times', 'pending_mentee_selection', 'scheduled',
    'arrival_confirmed', 'completed', 'not_completed', 'feedback_submitted',
    'rejected', 'cancelled'
  ));

CREATE TABLE "skills" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "embedding" vector(1536),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");
CREATE INDEX "skills_name_idx" ON "skills"("name");
CREATE INDEX "skills_embedding_hnsw_idx"
  ON "skills" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

CREATE TABLE "user_skills" (
  "user_id" UUID NOT NULL,
  "skill_id" UUID NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'self_reported',
  "proficiency" INTEGER,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_skills_pkey" PRIMARY KEY ("user_id", "skill_id"),
  CONSTRAINT "user_skills_proficiency_check" CHECK ("proficiency" IS NULL OR "proficiency" BETWEEN 1 AND 5)
);

CREATE INDEX "user_skills_skill_id_verified_at_idx" ON "user_skills"("skill_id", "verified_at");
ALTER TABLE "user_skills"
  ADD CONSTRAINT "user_skills_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- This table was present in the Prisma model but missing from migration history.
CREATE TABLE "availability_blocks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mentor_id" UUID NOT NULL,
  "meeting_id" UUID NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "is_booked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "availability_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_blocks_time_order_check" CHECK ("end_time" > "start_time")
);
CREATE INDEX "availability_blocks_meeting_id_idx" ON "availability_blocks"("meeting_id");
CREATE INDEX "availability_blocks_mentor_id_idx" ON "availability_blocks"("mentor_id");
ALTER TABLE "availability_blocks"
  ADD CONSTRAINT "availability_blocks_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "availability_blocks_mentor_id_fkey"
  FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- These tables were introduced without meeting FKs in earlier migrations.
ALTER TABLE "feedbacks"
  ADD CONSTRAINT "feedbacks_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_outcome_responses"
  ADD CONSTRAINT "meeting_outcome_responses_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_requests"
  ADD CONSTRAINT "feedback_requests_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mentor_mentee_blocks"
  ADD CONSTRAINT "mentor_mentee_blocks_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_alerts"
  ADD CONSTRAINT "admin_alerts_meeting_id_fkey"
  FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_alerts_subject_user_id_fkey"
  FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "admin_alerts_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "meetings_status_scheduled_time_idx" ON "meetings"("status", "scheduled_time");
CREATE INDEX "availability_blocks_mentor_meeting_start_idx"
  ON "availability_blocks"("mentor_id", "meeting_id", "start_time");
