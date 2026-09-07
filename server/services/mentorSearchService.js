const {
  understandMentorSearchQuery,
} = require("./mentorQueryUnderstandingService");
const {
  searchMentorsBySemanticQuery,
} = require("./mentorSemanticSearchService");
const {
  rankMentorsByHybridRelevance,
} = require("./mentorHybridRankingService");

const SEMANTIC_CANDIDATE_LIMIT = 50;
const FINAL_RESULT_LIMIT = 5;

function isMentorSearchDebugEnabled() {
  return process.env.MENTOR_SEARCH_DEBUG?.trim().toLowerCase() === "true";
}

function publicUser(user = {}) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    photoUrl: user.photoUrl,
    job: user.job,
    workplace: user.workplace,
    techStack: user.techStack,
  };
}

function publicMentor(mentor) {
  return {
    id: mentor.id,
    background: mentor.background,
    adviceTopics: mentor.adviceTopics,
    meetingsOffered: mentor.meetingsOffered,
    meetingLengthMinutes: mentor.meetingLengthMinutes,
    user: publicUser(mentor.user),
  };
}

function debugScores(rankedMentors) {
  return rankedMentors.map(({ mentor, scores }) => ({
    mentorId: mentor.id,
    topic: scores.topic,
    semantic: scores.semantic,
    techRole: scores.techRole,
    engagement: scores.engagement,
    final: scores.final,
  }));
}

function createMentorSearchService({
  understandMentorSearchQuery: understandQuery = understandMentorSearchQuery,
  searchMentorsBySemanticQuery: semanticSearch = searchMentorsBySemanticQuery,
  rankMentorsByHybridRelevance: hybridRank = rankMentorsByHybridRelevance,
  isDebugEnabled = isMentorSearchDebugEnabled,
} = {}) {
  async function searchMentors(query) {
    const queryUnderstanding = await understandQuery(query);
    const baseResult = { intent: queryUnderstanding.intent, mentors: [] };
    if (queryUnderstanding.intent !== "find_mentor") {
      return isDebugEnabled()
        ? { ...baseResult, debug: { queryUnderstanding, scores: [] } }
        : baseResult;
    }

    const candidates = await semanticSearch(query, {
      limit: SEMANTIC_CANDIDATE_LIMIT,
    });
    const rankedMentors = await hybridRank(candidates, queryUnderstanding, {
      limit: FINAL_RESULT_LIMIT,
    });
    const result = {
      intent: queryUnderstanding.intent,
      mentors: rankedMentors.map(({ mentor }) => publicMentor(mentor)),
    };
    return isDebugEnabled()
      ? {
          ...result,
          debug: {
            queryUnderstanding,
            scores: debugScores(rankedMentors),
          },
        }
      : result;
  }

  return { searchMentors };
}

const defaultService = createMentorSearchService();

module.exports = {
  FINAL_RESULT_LIMIT,
  SEMANTIC_CANDIDATE_LIMIT,
  createMentorSearchService,
  searchMentors: defaultService.searchMentors,
};

