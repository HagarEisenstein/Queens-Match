const {
  BUILT_IN_ADVICE_TOPICS,
} = require("../constants/mentorSearchTaxonomy");
const {
  QUERY_UNDERSTANDING_SCHEMA,
  createMentorQueryUnderstandingService,
} = require("./mentorQueryUnderstandingService");

const baseUnderstanding = {
  intent: "find_mentor",
  adviceTopics: [],
  techTerms: [],
  roleInterest: null,
  careerStage: null,
  freeTextNeed: "career guidance",
};

function createHarness(output) {
  const generateContent = jest.fn().mockResolvedValue({
    text: JSON.stringify(output),
  });
  const service = createMentorQueryUnderstandingService({ generateContent });
  return { service, generateContent };
}

describe("mentor query understanding", () => {
  it.each([
    ["Can someone help me improve my resume?", "CV / Resume Review"],
    ["אני רוצה שמישהי תעבור איתי על קורות החיים", "CV / Resume Review"],
    ["Improve my LinkedIn profile and About section", "LinkedIn Profile Review"],
    ["I want to practice coding interviews", "Technical Mock Interviews"],
    ["Practice tell me about yourself and my weaknesses", "HR / Behavioral Mock Interviews"],
    ["Help me prepare for system design interviews", "System Design Interviews"],
    ["Review my Node.js code for good practices", "Code Review & Best Practices"],
    ["Give feedback on my personal projects", "Portfolio / Personal Project Feedback"],
  ])("accepts the exact built-in topic for %s", async (query, topic) => {
    const { service } = createHarness({
      ...baseUnderstanding,
      adviceTopics: [topic],
      freeTextNeed: query,
    });

    await expect(service.understandMentorSearchQuery(query)).resolves.toEqual({
      ...baseUnderstanding,
      adviceTopics: [topic],
      freeTextNeed: query,
    });
  });

  it.each([
    ["I need help", "clarification_needed"],
    ["What is the weather?", "out_of_scope"],
  ])("accepts the %s intent classification", async (query, intent) => {
    const { service } = createHarness({
      ...baseUnderstanding,
      intent,
      freeTextNeed: query,
    });

    const result = await service.understandMentorSearchQuery(query);

    expect(result.intent).toBe(intent);
  });

  it("uses Gemini JSON structured output with the closed Queens Match schema", async () => {
    const { service, generateContent } = createHarness({
      ...baseUnderstanding,
      adviceTopics: ["Technical Mock Interviews"],
      techTerms: ["Node.js"],
      roleInterest: "backend",
      freeTextNeed: "backend coding interview practice",
    });

    await service.understandMentorSearchQuery("backend coding interview practice");

    expect(generateContent).toHaveBeenCalledTimes(1);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBeTruthy();
    expect(request.config).toEqual(
      expect.objectContaining({
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: QUERY_UNDERSTANDING_SCHEMA,
      })
    );
    expect(request.config.responseJsonSchema.additionalProperties).toBe(false);
    expect(request.config.responseJsonSchema.properties.intent.enum).toEqual([
      "find_mentor",
      "clarification_needed",
      "out_of_scope",
    ]);
    expect(
      request.config.responseJsonSchema.properties.adviceTopics.items.enum
    ).toEqual(BUILT_IN_ADVICE_TOPICS);
    expect(JSON.stringify(request)).toContain("CV / Resume Review");
    expect(JSON.stringify(request)).not.toContain("mentorId");
  });

  it.each([
    ["non-JSON", "not JSON"],
    ["missing fields", JSON.stringify({ intent: "find_mentor" })],
    [
      "invented topic",
      JSON.stringify({
        ...baseUnderstanding,
        adviceTopics: ["General Career Coaching"],
      }),
    ],
    [
      "extra field",
      JSON.stringify({ ...baseUnderstanding, mentorIds: ["mentor-1"] }),
    ],
    [
      "unknown career stage",
      JSON.stringify({ ...baseUnderstanding, careerStage: "wizard" }),
    ],
  ])("rejects unsafe structured output: %s", async (_, text) => {
    const generateContent = jest.fn().mockResolvedValue({ text });
    const service = createMentorQueryUnderstandingService({ generateContent });

    await expect(
      service.understandMentorSearchQuery("help me find a mentor")
    ).rejects.toThrow("invalid structured output");
  });

  it.each([null, "", "   ", 42])(
    "rejects invalid query input %p before Gemini",
    async (query) => {
      const { service, generateContent } = createHarness(baseUnderstanding);

      await expect(service.understandMentorSearchQuery(query)).rejects.toThrow(
        "query must be a non-empty string"
      );
      expect(generateContent).not.toHaveBeenCalled();
    }
  );
});

