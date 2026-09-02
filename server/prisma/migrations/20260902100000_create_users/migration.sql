CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "roles" TEXT[] NOT NULL,
    "full_name" TEXT,
    "photo_url" TEXT,
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "job" TEXT,
    "workplace" TEXT,
    "years_experience" INTEGER,
    "tech_stack" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
