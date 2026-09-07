const {
  createMentorSearchService,
} = require("./mentorSearchService");

const queryUnderstanding = {
  intent: "find_mentor",
  adviceTopics: ["CV / Resume Review"],
  techTerms: ["Node.js"],
  roleInterest: "backend",
  careerStage: null,
  freeTextNeed: "review my CV for backend roles",
};

const candidate = {
  id: "mentor-1",
  background: "Backend engineer",
  adviceTopics: ["CV / Resume Review"],
  meetingsOffered: 3,
  meetingLengthMinutes: 45,
  semanticScore: 0.88,
  embedding: [0.1, 0.2],
  documentText: "private search document",
  user: {
    id: "user-1",
    username: "ada",
    fullName: "Ada Mentor",
    photoUrl: null,
    job: "Staff Engineer",
    workplace: "QueenB",
    techStack: ["Node.js"],
  },
};

function createHarness({ understanding = queryUnderstanding, debug = false } = {}) {
  const understandMentorSearchQuery = jest.fn().mockResolvedValue(understanding);
  const searchMentorsBySemanticQuery = jest.fn().mockResolvedValue([candidate]);
  const rankMentorsByHybridRelevance = jest.fn().mockResolvedValue([
    {
      mentor: candidate,
      scores: {
        topic: 1,
        semantic: 0.88,
        techRole: 1,
        engagement: 0,
        final: 0.91,
      },
    },
  ]);
  const service = createMentorSearchService({
    understandMentorSearchQuery,
    searchMentorsBySemanticQuery,
    rankMentorsByHybridRelevance,
    isDebugEnabled: () => debug,
  });
  return {
    service,
    understandMentorSearchQuery,
    searchMentorsBySemanticQuery,
    rankMentorsByHybridRelevance,
  };
}

describe("mentor search orchestration", () => {
  it("understands the query, retrieves 50 candidates, and returns five hybrid matches", async () => {
    const harness = createHarness();

    const result = await harness.service.searchMentors("help with my CV");

    expect(harness.understandMentorSearchQuery).toHaveBeenCalledWith(
      "help with my CV"
    );
    expect(harness.searchMentorsBySemanticQuery).toHaveBeenCalledWith(
      "help with my CV",
      { limit: 50 }
    );
    expect(harness.rankMentorsByHybridRelevance).toHaveBeenCalledWith(
      [candidate],
      queryUnderstanding,
      { limit: 5 }
    );
    expect(result).toEqual({
      intent: "find_mentor",
      mentors: [
        {
          id: candidate.id,
          background: candidate.background,
          adviceTopics: candidate.adviceTopics,
          meetingsOffered: candidate.meetingsOffered,
          meetingLengthMinutes: candidate.meetingLengthMinutes,
          user: candidate.user,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("semanticScore");
    expect(JSON.stringify(result)).not.toContain("embedding");
    expect(JSON.stringify(result)).not.toContain("documentText");
    expect(JSON.stringify(result)).not.toContain("scores");
  });

  it.each(["clarification_needed", "out_of_scope"])(
    "returns %s without embedding or ranking",
    async (intent) => {
      const harness = createHarness({
        understanding: { ...queryUnderstanding, intent, adviceTopics: [] },
      });

      await expect(harness.service.searchMentors("help")).resolves.toEqual({
        intent,
        mentors: [],
      });
      expect(harness.searchMentorsBySemanticQuery).not.toHaveBeenCalled();
      expect(harness.rankMentorsByHybridRelevance).not.toHaveBeenCalled();
    }
  );

  it("does not return the signed-in user's own mentor profile", async () => {
    const harness = createHarness();
    const ownProfile = {
      ...candidate,
      id: "mentor-self",
      user: { ...candidate.user, id: "user-self" },
    };
    harness.searchMentorsBySemanticQuery.mockResolvedValue([
      ownProfile,
      candidate,
    ]);

    await harness.service.searchMentors("help with my CV", {
      excludeUserId: "user-self",
    });

    expect(harness.rankMentorsByHybridRelevance).toHaveBeenCalledWith(
      [candidate],
      queryUnderstanding,
      { limit: 5 }
    );
  });

  it("exposes interpretation and normalized score diagnostics only in debug mode", async () => {
    const harness = createHarness({ debug: true });

    const result = await harness.service.searchMentors("help with my CV");

    expect(result.debug).toEqual({
      queryUnderstanding,
      scores: [
        {
          mentorId: candidate.id,
          topic: 1,
          semantic: 0.88,
          techRole: 1,
          engagement: 0,
          final: 0.91,
        },
      ],
    });
    expect(JSON.stringify(result.debug)).not.toContain("embedding");
    expect(JSON.stringify(result.debug)).not.toContain("documentText");
    expect(JSON.stringify(result.debug)).not.toContain("rawEngagement");
  });
});
