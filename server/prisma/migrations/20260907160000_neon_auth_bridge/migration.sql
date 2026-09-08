-- Allow Google-only accounts (no local password) and link Neon Auth identities.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_user_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_neon_auth_user_id_key"
  ON "users"("neon_auth_user_id");
