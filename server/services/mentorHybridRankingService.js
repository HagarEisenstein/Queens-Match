const prisma = require("../commons/db");
const logger = require("../commons/logger");
const {
  getMentorEngagementScores,
} = require("./mentorMatchingService");

const HYBRID_WEIGHTS = Object.freeze({
  topic: 0.5,
  semantic: 0.3,
  techRole: 0.15,
  engagement: 0.05,
});
const DEFAULT_RESULT_LIMIT = 5;

function calculateExplicitTopicScore(mentor, queryTopics) {
  if (!Array.isArray(queryTopics) || queryTopics.length === 0) return 0;
  const mentorTopics = new Set(
    Array.isArray(mentor?.adviceTopics) ? mentor.adviceTopics : []
  );
  const matchingTopics = queryTopics.filter((topic) => mentorTopics.has(topic));
  return matchingTopics.length / queryTopics.length;
}

function normalizeSearchText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildTechRoleText(mentor) {
  const user = mentor?.user || {};
  return normalizeSearchText(
    [
      mentor?.background,
      user.job,
      user.workplace,
      ...(Array.isArray(user.techStack) ? user.techStack : []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function calculateConceptMatchScore(haystack, concept) {
  const normalizedConcept = normalizeSearchText(concept);
  if (!normalizedConcept || !haystack) return 0;
  if (` ${haystack} `.includes(` ${normalizedConcept} `)) return 1;

  const haystackTokens = new Set(haystack.split(" "));
  const conceptTokens = normalizedConcept.split(" ");
  const matchingTokens = conceptTokens.filter((token) => haystackTokens.has(token));
  return matchingTokens.length / conceptTokens.length;
}

function getTechRoleConcepts(queryUnderstanding) {
  const terms = Array.isArray(queryUnderstanding?.techTerms)
    ? queryUnderstanding.techTerms
    : [];
  return queryUnderstanding?.roleInterest
    ? [...terms, queryUnderstanding.roleInterest]
    : terms;
}

function calculateTechRoleScore(mentor, queryUnderstanding) {
  const concepts = getTechRoleConcepts(queryUnderstanding);
  if (concepts.length === 0) return 0;
  const haystack = buildTechRoleText(mentor);
  const total = concepts.reduce(
    (sum, concept) => sum + calculateConceptMatchScore(haystack, concept),
    0
  );
  return total / concepts.length;
}

function normalizeEngagementScores(rawScores) {
  if (!(rawScores instanceof Map)) {
    throw new TypeError("raw engagement scores must be a Map");
  }
  if (rawScores.size === 0) return new Map();

  const values = Array.from(rawScores.values());
  if (!values.every(Number.isFinite)) {
    throw new TypeError("raw engagement scores must be finite numbers");
  }
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) {
    return new Map(Array.from(rawScores.keys(), (key) => [key, 0]));
  }
  return new Map(
    Array.from(rawScores, ([key, value]) => [
      key,
      (value - minimum) / (maximum - minimum),
    ])
  );
}

function calculateActiveWeights(queryUnderstanding) {
  const active = {
    semantic: HYBRID_WEIGHTS.semantic,
    engagement: HYBRID_WEIGHTS.engagement,
  };
  if (queryUnderstanding.adviceTopics.length > 0) {
    active.topic = HYBRID_WEIGHTS.topic;
  }
  if (getTechRoleConcepts(queryUnderstanding).length > 0) {
    active.techRole = HYBRID_WEIGHTS.techRole;
  }

  const totalWeight = Object.values(active).reduce((sum, weight) => sum + weight, 0);
  return Object.fromEntries(
    Object.entries(active).map(([signal, weight]) => [signal, weight / totalWeight])
  );
}

function calculateFinalScore(scores, activeWeights) {
  return Object.entries(activeWeights).reduce(
    (sum, [signal, weight]) => sum + weight * scores[signal],
    0
  );
}

function scoreMentor(mentor, queryUnderstanding, engagementScores) {
  if (!Number.isFinite(mentor.semanticScore)) {
    throw new TypeError("mentor semantic scores must be finite numbers");
  }
  const activeWeights = calculateActiveWeights(queryUnderstanding);
  const scores = {
    topic: calculateExplicitTopicScore(mentor, queryUnderstanding.adviceTopics),
    semantic: mentor.semanticScore,
    techRole: calculateTechRoleScore(mentor, queryUnderstanding),
    engagement: engagementScores.get(mentor.id) || 0,
  };
  scores.final = calculateFinalScore(scores, activeWeights);
  return { mentor, scores, activeWeights };
}

function compareHybridEntries(left, right) {
  return (
    right.scores.final - left.scores.final ||
    right.scores.topic - left.scores.topic ||
    right.scores.semantic - left.scores.semantic ||
    right.scores.techRole - left.scores.techRole ||
    right.scores.engagement - left.scores.engagement ||
    left.originalIndex - right.originalIndex
  );
}

function rankMentorsByHybridScore(
  mentors,
  queryUnderstanding,
  { rawEngagementScores = new Map(), limit = mentors.length } = {}
) {
  if (!Array.isArray(mentors)) throw new TypeError("mentors must be an array");
  const engagementScores = normalizeEngagementScores(
    rawEngagementScores.size > 0
      ? rawEngagementScores
      : new Map(mentors.map((mentor) => [mentor.id, 0]))
  );
  return mentors
    .map((mentor, originalIndex) => ({
      ...scoreMentor(mentor, queryUnderstanding, engagementScores),
      originalIndex,
    }))
    .sort(compareHybridEntries)
    .slice(0, limit)
    .map(({ originalIndex, ...entry }) => entry);
}

async function loadRawEngagementScores(mentors) {
  try {
    return await getMentorEngagementScores(mentors, { prismaClient: prisma });
  } catch (error) {
    logger.warn("Mentor engagement scoring unavailable; using neutral values.", {
      error: error.message,
    });
    return new Map(mentors.map((mentor) => [mentor.id, 0]));
  }
}

async function rankMentorsByHybridRelevance(
  mentors,
  queryUnderstanding,
  { limit = DEFAULT_RESULT_LIMIT } = {}
) {
  const rawEngagementScores = await loadRawEngagementScores(mentors);
  return rankMentorsByHybridScore(mentors, queryUnderstanding, {
    rawEngagementScores,
    limit,
  });
}

module.exports = {
  HYBRID_WEIGHTS,
  calculateExplicitTopicScore,
  calculateTechRoleScore,
  normalizeEngagementScores,
  rankMentorsByHybridRelevance,
  rankMentorsByHybridScore,
};
