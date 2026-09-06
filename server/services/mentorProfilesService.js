const prisma = require("../commons/db");
const logger = require("../commons/logger");
const {
  rankMentorsByEngagement,
  rankMentorsByTopicRelevance,
} = require("./mentorMatchingService");

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  photoUrl: true,
  job: true,
  workplace: true,
  yearsExperience: true,
  githubUrl: true,
  linkedinUrl: true,
};

const profileInclude = {
  user: { select: userSelect },
};

function normalizeAdviceTopics(adviceTopics) {
  if (!Array.isArray(adviceTopics)) return [];
  return Array.from(
    new Set(
      adviceTopics
        .filter((topic) => typeof topic === "string")
        .map((topic) => topic.trim())
        .filter(Boolean)
    )
  );
}

async function getMentors({ adviceTopics = [] } = {}) {
  const normalizedTopics = normalizeAdviceTopics(adviceTopics);
  const mentors = await prisma.mentorProfile.findMany({
    where: {
      user: { roles: { has: "mentor" } },
      ...(normalizedTopics.length > 0
        ? { adviceTopics: { hasSome: normalizedTopics } }
        : {}),
    },
    include: profileInclude,
    orderBy: { updatedAt: "desc" },
  });

  if (normalizedTopics.length === 0 || mentors.length < 2) return mentors;

  try {
    return await rankMentorsByEngagement(mentors, {
      prismaClient: prisma,
      adviceTopics: normalizedTopics,
    });
  } catch (error) {
    logger.warn(
      "Mentor engagement ranking unavailable; returning topic-ranked hard-filtered mentors.",
      { error: error.message }
    );
    return rankMentorsByTopicRelevance(mentors, normalizedTopics);
  }
}

async function getMentorById(id) {
  return prisma.mentorProfile.findFirst({
    where: { id, user: { roles: { has: "mentor" } } },
    include: profileInclude,
  });
}

async function getMentorByUserId(userId) {
  return prisma.mentorProfile.findUnique({
    where: { userId },
    include: profileInclude,
  });
}

async function upsertMentorProfile(userId, data) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    await transaction.user.update({
      where: { id: userId },
      data: { roles: Array.from(new Set([...user.roles, "mentor"])) },
    });

    return transaction.mentorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      include: profileInclude,
    });
  });
}

module.exports = {
  getMentors,
  getMentorById,
  getMentorByUserId,
  upsertMentorProfile,
};
