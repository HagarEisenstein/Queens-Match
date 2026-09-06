const prisma = require("../commons/db");
const {
  EMBEDDING_DIMENSIONS,
  embedSearchQuery,
} = require("./embeddingService");
const { toPgVectorLiteral } = require("./pgVector");

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 20;

function normalizeQuery(query) {
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("query must be a non-empty string");
  }
  return query.trim();
}

function normalizeLimit(limit = DEFAULT_SEARCH_LIMIT) {
  if (!Number.isInteger(limit)) {
    throw new TypeError("limit must be an integer");
  }
  return Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);
}

function createMentorSemanticSearchRepository(prismaClient) {
  return {
    findNearest(vectorLiteral, limit) {
      return prismaClient.$queryRaw`
        WITH "query_embedding" AS (
          SELECT ${vectorLiteral}::vector AS "embedding"
        )
        SELECT
          mp."id",
          mp."background",
          mp."advice_topics" AS "adviceTopics",
          mp."meetings_offered" AS "meetingsOffered",
          mp."meeting_length_minutes" AS "meetingLengthMinutes",
          u."id" AS "userId",
          u."username",
          u."full_name" AS "fullName",
          u."photo_url" AS "photoUrl",
          u."job",
          u."workplace",
          u."tech_stack" AS "techStack",
          1 - (mse."embedding" <=> "query_embedding"."embedding")
            AS "semanticScore"
        FROM "mentor_search_embeddings" AS mse
        JOIN "mentor_profiles" AS mp
          ON mp."id" = mse."mentor_profile_id"
        JOIN "users" AS u
          ON u."id" = mp."user_id"
        CROSS JOIN "query_embedding"
        ORDER BY mse."embedding" <=> "query_embedding"."embedding" ASC
        LIMIT ${limit}
      `;
    },
  };
}

function mapMentorResult(row) {
  const semanticScore = Number(row.semanticScore);
  if (!Number.isFinite(semanticScore)) {
    throw new Error("Semantic search returned an invalid score");
  }

  return {
    id: row.id,
    background: row.background,
    adviceTopics: row.adviceTopics,
    meetingsOffered: row.meetingsOffered,
    meetingLengthMinutes: row.meetingLengthMinutes,
    user: {
      id: row.userId,
      username: row.username,
      fullName: row.fullName,
      photoUrl: row.photoUrl,
      job: row.job,
      workplace: row.workplace,
      techStack: row.techStack,
    },
    semanticScore,
  };
}

function createMentorSemanticSearchService({
  repository,
  embedSearchQuery: embedQuery,
}) {
  async function searchMentorsBySemanticQuery(query, options = {}) {
    const normalizedQuery = normalizeQuery(query);
    const limit = normalizeLimit(options.limit);
    const embedding = await embedQuery(normalizedQuery);
    const vectorLiteral = toPgVectorLiteral(embedding, EMBEDDING_DIMENSIONS);
    const rows = await repository.findNearest(vectorLiteral, limit);
    return rows.map(mapMentorResult);
  }

  return { searchMentorsBySemanticQuery };
}

const defaultService = createMentorSemanticSearchService({
  repository: createMentorSemanticSearchRepository(prisma),
  embedSearchQuery,
});

module.exports = {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  createMentorSemanticSearchRepository,
  createMentorSemanticSearchService,
  searchMentorsBySemanticQuery: defaultService.searchMentorsBySemanticQuery,
};
