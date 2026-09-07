CREATE TABLE "admin_invites" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "invited_by" UUID NOT NULL,
  "accepted_by" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_invites_token_hash_key" ON "admin_invites"("token_hash");
CREATE INDEX "admin_invites_email_accepted_at_idx" ON "admin_invites"("email", "accepted_at");
CREATE INDEX "admin_invites_expires_at_idx" ON "admin_invites"("expires_at");
