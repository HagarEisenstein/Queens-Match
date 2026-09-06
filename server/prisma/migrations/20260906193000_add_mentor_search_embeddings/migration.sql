CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "mentor_search_embeddings" (
    "mentor_profile_id" UUID NOT NULL,
    "embedding" vector(768) NOT NULL,
    "document_text" TEXT NOT NULL,
    "document_hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_search_embeddings_pkey"
        PRIMARY KEY ("mentor_profile_id"),
    CONSTRAINT "mentor_search_embeddings_dimensions_check"
        CHECK ("dimensions" = 768),
    CONSTRAINT "mentor_search_embeddings_document_hash_check"
        CHECK (char_length("document_hash") = 64)
);

ALTER TABLE "mentor_search_embeddings"
ADD CONSTRAINT "mentor_search_embeddings_mentor_profile_id_fkey"
FOREIGN KEY ("mentor_profile_id") REFERENCES "mentor_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
