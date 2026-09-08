const prisma = require("../commons/db");
const { AppError } = require("../middleware/errors");
const {
  generateMentorSearchEmbedding,
} = require("./mentorSearchEmbeddingService");

const BACKFILL_IN_PROGRESS_CODE = "MENTOR_EMBEDDING_BACKFILL_IN_PROGRESS";
const GENERATION_FAILURE_CODE = "EMBEDDING_GENERATION_FAILED";

function createSummary(total) {
  return {
    total,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };
}

async function generateOneSafely(mentorProfileId, generateEmbedding) {
  try {
    const result = await generateEmbedding(mentorProfileId);
    return { status: result.updated === true ? "updated" : "skipped" };
  } catch {
    return {
      status: "failed",
      failure: { mentorProfileId, code: GENERATION_FAILURE_CODE },
    };
  }
}

async function processMentorsSequentially(mentorProfiles, generateEmbedding) {
  const summary = createSummary(mentorProfiles.length);
  for (const { id } of mentorProfiles) {
    const result = await generateOneSafely(id, generateEmbedding);
    summary[result.status] += 1;
    if (result.failure) summary.failures.push(result.failure);
  }
  return summary;
}

function createMentorSearchBackfillService({
  prismaClient,
  generateMentorSearchEmbedding: generateEmbedding,
}) {
  let isBackfillRunning = false;

  async function backfillMentorSearchEmbeddings() {
    if (isBackfillRunning) {
      throw new AppError(
        409,
        BACKFILL_IN_PROGRESS_CODE,
        "Mentor embedding backfill is already running."
      );
    }

    isBackfillRunning = true;
    try {
      const mentorProfiles = await prismaClient.mentorProfile.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      });
      return await processMentorsSequentially(mentorProfiles, generateEmbedding);
    } finally {
      isBackfillRunning = false;
    }
  }

  return { backfillMentorSearchEmbeddings };
}

const defaultService = createMentorSearchBackfillService({
  prismaClient: prisma,
  generateMentorSearchEmbedding,
});

module.exports = {
  BACKFILL_IN_PROGRESS_CODE,
  GENERATION_FAILURE_CODE,
  createMentorSearchBackfillService,
  backfillMentorSearchEmbeddings:
    defaultService.backfillMentorSearchEmbeddings,
};
