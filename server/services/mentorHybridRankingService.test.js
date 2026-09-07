const {
  HYBRID_WEIGHTS,
  calculateExplicitTopicScore,
  calculateTechRoleScore,
  normalizeEngagementScores,
  rankMentorsByHybridScore,
} = require("./mentorHybridRankingService");

function mentor({
  id,
  topic,
  semanticScore,
  background = "",
  techStack = [],
  job = "",
  workplace = "",
}) {
  return {
    id,
    background,
    adviceTopics: topic ? [topic] : [],
    meetingsOffered: 2,
    meetingLengthMinutes: 45,
    semanticScore,
    user: { id: `user-${id}`, techStack, job, workplace },
  };
}

function understanding(overrides = {}) {
  return {
    intent: "find_mentor",
    adviceTopics: [],
    techTerms: [],
    roleInterest: null,
    careerStage: null,
    freeTextNeed: "mentor help",
    ...overrides,
  };
}

describe("hybrid mentor ranking", () => {
  it("keeps the configured priorities as named constants", () => {
    expect(HYBRID_WEIGHTS).toEqual({
      topic: 0.5,
      semantic: 0.3,
      techRole: 0.15,
      engagement: 0.05,
    });
  });

  it("scores exact topic coverage as a ratio", () => {
    expect(
      calculateExplicitTopicScore(
        { adviceTopics: ["CV / Resume Review"] },
        ["CV / Resume Review", "LinkedIn Profile Review"]
      )
    ).toBe(0.5);
  });

  it("makes an exact CV topic beat a slightly higher HR semantic score", () => {
    const cv = mentor({
      id: "cv",
      topic: "CV / Resume Review",
      semanticScore: 0.66,
    });
    const hr = mentor({
      id: "hr",
      topic: "HR / Behavioral Mock Interviews",
      semanticScore: 0.69,
    });

    const ranked = rankMentorsByHybridScore(
      [hr, cv],
      understanding({ adviceTopics: ["CV / Resume Review"] }),
      { rawEngagementScores: new Map([["cv", 0], ["hr", 100]]) }
    );

    expect(ranked.map(({ mentor: item }) => item.id)).toEqual(["cv", "hr"]);
  });

  it("strongly boosts an exact technical interview topic", () => {
    const exact = mentor({
      id: "exact",
      topic: "Technical Mock Interviews",
      semanticScore: 0.6,
    });
    const related = mentor({
      id: "related",
      topic: "System Design Interviews",
      semanticScore: 0.8,
    });

    const ranked = rankMentorsByHybridScore(
      [related, exact],
      understanding({ adviceTopics: ["Technical Mock Interviews"] })
    );

    expect(ranked[0].mentor).toBe(exact);
    expect(ranked[0].scores.topic).toBe(1);
  });

  it("keeps strong free-text interview experience competitive without an exact topic", () => {
    const exact = mentor({
      id: "exact",
      topic: "Technical Mock Interviews",
      semanticScore: 0.62,
      background: "Occasional interview practice",
      job: "Backend Engineer",
    });
    const freeText = mentor({
      id: "free-text",
      semanticScore: 0.92,
      background:
        "I interview backend candidates and coach coding interviews at Google",
      job: "Backend Hiring Manager",
    });
    const unrelated = mentor({
      id: "unrelated",
      topic: "HR / Behavioral Mock Interviews",
      semanticScore: 0.64,
      background: "HR interview coaching",
    });

    const ranked = rankMentorsByHybridScore(
      [unrelated, freeText, exact],
      understanding({
        adviceTopics: ["Technical Mock Interviews"],
        roleInterest: "backend",
      })
    );

    expect(ranked.map(({ mentor: item }) => item.id)).toEqual([
      "exact",
      "free-text",
      "unrelated",
    ]);
    expect(ranked).toHaveLength(3);
  });

  it("uses tech stack matches in the tech/role score", () => {
    const pythonMentor = mentor({
      id: "python",
      semanticScore: 0.5,
      techStack: ["Python", "FastAPI"],
    });

    expect(
      calculateTechRoleScore(
        pythonMentor,
        understanding({ techTerms: ["Python"] })
      )
    ).toBe(1);
  });

  it("uses job role matches in the tech/role score", () => {
    const backendMentor = mentor({
      id: "backend",
      semanticScore: 0.5,
      job: "Senior Backend Engineer",
    });

    expect(
      calculateTechRoleScore(
        backendMentor,
        understanding({ roleInterest: "backend" })
      )
    ).toBe(1);
  });

  it("normalizes engagement to 0..1 and maps equal values to zero", () => {
    expect(
      Array.from(
        normalizeEngagementScores(
          new Map([["low", 100], ["mid", 200], ["high", 300]])
        ).entries()
      )
    ).toEqual([["low", 0], ["mid", 0.5], ["high", 1]]);
    expect(
      Array.from(
        normalizeEngagementScores(new Map([["a", 42], ["b", 42]])).values()
      )
    ).toEqual([0, 0]);
  });

  it("does not let maximum engagement override product relevance", () => {
    const relevant = mentor({
      id: "relevant",
      topic: "CV / Resume Review",
      semanticScore: 0.6,
    });
    const popular = mentor({
      id: "popular",
      topic: "HR / Behavioral Mock Interviews",
      semanticScore: 0.7,
    });

    const ranked = rankMentorsByHybridScore(
      [popular, relevant],
      understanding({ adviceTopics: ["CV / Resume Review"] }),
      { rawEngagementScores: new Map([["relevant", 0], ["popular", 1_000_000]]) }
    );

    expect(ranked[0].mentor).toBe(relevant);
  });

  it("renormalizes active weights when no topic is extracted", () => {
    const candidate = mentor({
      id: "backend-python",
      semanticScore: 1,
      techStack: ["Python"],
      job: "Backend Engineer",
    });

    const [ranked] = rankMentorsByHybridScore(
      [candidate],
      understanding({ techTerms: ["Python"], roleInterest: "backend" }),
      { rawEngagementScores: new Map([[candidate.id, 10]]) }
    );

    expect(ranked.activeWeights.topic).toBeUndefined();
    expect(ranked.activeWeights).toEqual({
      semantic: 0.6,
      techRole: 0.3,
      engagement: 0.1,
    });
    expect(ranked.scores.final).toBeCloseTo(0.9, 10);
  });

  it("does not hard-filter missing topics and sorts final scores descending", () => {
    const mentors = [
      mentor({ id: "low", semanticScore: 0.2 }),
      mentor({ id: "high", semanticScore: 0.9 }),
      mentor({ id: "exact", topic: "CV / Resume Review", semanticScore: 0.5 }),
    ];

    const ranked = rankMentorsByHybridScore(
      mentors,
      understanding({ adviceTopics: ["CV / Resume Review"] })
    );

    expect(ranked).toHaveLength(3);
    expect(ranked.map(({ scores }) => scores.final)).toEqual(
      [...ranked.map(({ scores }) => scores.final)].sort((a, b) => b - a)
    );
  });
});

