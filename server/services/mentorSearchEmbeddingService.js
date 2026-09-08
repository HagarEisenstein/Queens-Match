const { createHash } = require("crypto");
const prisma = require("../commons/db");
const {
  EMBEDDING_DIMENSIONS,
  embedSearchDocument,
  getEmbeddingMetadata,
} = require("./embeddingService");
const { buildMentorSearchDocument } = require("./mentorSearchDocument");
const { toPgVectorLiteral } = require("./pgVector");

const mentorSearchDocumentSelect = {
  id: true,
  background: true,
  adviceTopics: true,
  user: {
    select: {
      job: true,
      workplace: true,
      techStack: true,
    },
  },
};

function hashMentorSearchDocument(documentText) {
  if (typeof documentText !== "string") {
    throw new TypeError("Mentor search document must be a string");
  }
  return createHash("sha256").update(documentText, "utf8").digest("hex");
}

function createMentorSearchEmbeddingRepository(prismaClient) {
  return {
    async findCurrentMetadata(mentorProfileId) {
      const rows = await prismaClient.$queryRaw`
        SELECT
          "document_hash" AS "documentHash",
          "model",
          "dimensions"
        FROM "mentor_search_embeddings"
        WHERE "mentor_profile_id" = ${mentorProfileId}::uuid
        LIMIT 1
      `;
      return rows[0] || null;
    },

    async upsert(record) {
      if (record.dimensions !== EMBEDDING_DIMENSIONS) {
        throw new TypeError(
          `Embedding dimensions must be exactly ${EMBEDDING_DIMENSIONS}`
        );
      }
      const vectorLiteral = toPgVectorLiteral(
        record.embedding,
        EMBEDDING_DIMENSIONS
      );
      await prismaClient.$executeRaw`
        INSERT INTO "mentor_search_embeddings" (
          "mentor_profile_id",
          "embedding",
          "document_text",
          "document_hash",
          "model",
          "dimensions",
          "created_at",
          "updated_at"
        ) VALUES (
          ${record.mentorProfileId}::uuid,
          ${vectorLiteral}::vector,
          ${record.documentText},
          ${record.documentHash},
          ${record.model},
          ${record.dimensions},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("mentor_profile_id") DO UPDATE SET
          "embedding" = EXCLUDED."embedding",
          "document_text" = EXCLUDED."document_text",
          "document_hash" = EXCLUDED."document_hash",
          "model" = EXCLUDED."model",
          "dimensions" = EXCLUDED."dimensions",
          "updated_at" = CURRENT_TIMESTAMP
      `;
    },
  };
}

function metadataMatches(current, documentHash, metadata) {
  return (
    current?.documentHash === documentHash &&
    current.model === metadata.model &&
    current.dimensions === metadata.dimensions
  );
}

function metadataResult(mentorProfileId, updated, metadata) {
  return {
    mentorProfileId,
    updated,
    dimensions: metadata.dimensions,
    model: metadata.model,
  };
}

function createMentorSearchEmbeddingService({
  prismaClient,
  repository = createMentorSearchEmbeddingRepository(prismaClient),
  embedSearchDocument: embedDocument,
  getEmbeddingMetadata: readMetadata,
}) {
  async function generateMentorSearchEmbedding(mentorProfileId) {
    if (typeof mentorProfileId !== "string" || !mentorProfileId.trim()) {
      throw new TypeError("mentorProfileId must be a non-empty string");
    }

    const mentor = await prismaClient.mentorProfile.findUnique({
      where: { id: mentorProfileId },
      select: mentorSearchDocumentSelect,
    });
    if (!mentor) {
      const error = new Error("Mentor profile not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    const documentText = buildMentorSearchDocument(mentor);
    const documentHash = hashMentorSearchDocument(documentText);
    const metadata = readMetadata();
    const current = await repository.findCurrentMetadata(mentorProfileId);
    if (metadataMatches(current, documentHash, metadata)) {
      return metadataResult(mentorProfileId, false, metadata);
    }

    const embedding = await embedDocument(documentText);
    await repository.upsert({
      mentorProfileId,
      embedding,
      documentText,
      documentHash,
      model: metadata.model,
      dimensions: metadata.dimensions,
    });
    return metadataResult(mentorProfileId, true, metadata);
  }

  return { generateMentorSearchEmbedding };
}

const defaultService = createMentorSearchEmbeddingService({
  prismaClient: prisma,
  embedSearchDocument,
  getEmbeddingMetadata,
});

module.exports = {
  createMentorSearchEmbeddingRepository,
  createMentorSearchEmbeddingService,
  generateMentorSearchEmbedding:
    defaultService.generateMentorSearchEmbedding,
  hashMentorSearchDocument,
  mentorSearchDocumentSelect,
  EMBEDDING_DIMENSIONS,
};
