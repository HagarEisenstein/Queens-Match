const { GoogleGenAI } = require("@google/genai");
const {
  BUILT_IN_ADVICE_TOPICS,
  CAREER_STAGES,
  MENTOR_SEARCH_INTENTS,
} = require("../constants/mentorSearchTaxonomy");

const DEFAULT_QUERY_UNDERSTANDING_MODEL = "gemini-2.5-flash";
const MAX_QUERY_LENGTH = 2_000;
const MAX_TECH_TERMS = 10;
const MAX_TECH_TERM_LENGTH = 50;
const MAX_ROLE_LENGTH = 100;
const MAX_FREE_TEXT_NEED_LENGTH = 500;
const RESULT_FIELDS = Object.freeze([
  "intent",
  "adviceTopics",
  "techTerms",
  "roleInterest",
  "careerStage",
  "freeTextNeed",
]);

const nullableStringSchema = (maxLength, description) => ({
  anyOf: [
    { type: "string", maxLength, description },
    { type: "null" },
  ],
});

const QUERY_UNDERSTANDING_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: RESULT_FIELDS,
  propertyOrdering: RESULT_FIELDS,
  properties: {
    intent: {
      type: "string",
      enum: MENTOR_SEARCH_INTENTS,
      description: "The mentor-search routing intent.",
    },
    adviceTopics: {
      type: "array",
      maxItems: BUILT_IN_ADVICE_TOPICS.length,
      items: { type: "string", enum: BUILT_IN_ADVICE_TOPICS },
      description: "Only exact Queens Match built-in advice topic strings.",
    },
    techTerms: {
      type: "array",
      maxItems: MAX_TECH_TERMS,
      items: { type: "string", maxLength: MAX_TECH_TERM_LENGTH },
      description: "Short technologies, languages, frameworks, or platforms.",
    },
    roleInterest: nullableStringSchema(
      MAX_ROLE_LENGTH,
      "A short target role such as backend, frontend, data, or product."
    ),
    careerStage: {
      anyOf: [
        { type: "string", enum: CAREER_STAGES },
        { type: "null" },
      ],
      description: "A normalized career stage, or null when unstated.",
    },
    freeTextNeed: {
      type: "string",
      maxLength: MAX_FREE_TEXT_NEED_LENGTH,
      description: "A concise faithful summary of the user's mentor need.",
    },
  },
});

const DOMAIN_INSTRUCTION = `You interpret one user request for Queens Match, a mentor-matching product.

Return structured data only. Never choose mentors, invent mentor IDs, or answer the user's unrelated question.

Allowed intents:
- find_mentor: enough information exists to look for a mentor.
- clarification_needed: the request is genuinely too vague, such as "I need help". Do not overuse this.
- out_of_scope: the request is unrelated to career, interview, or technical mentorship, such as homework completion, weather, or cooking.

The only built-in advice topics are:
- Career Documents: CV / Resume Review; LinkedIn Profile Review
- Interview Prep: Technical Mock Interviews; HR / Behavioral Mock Interviews; System Design Interviews
- Technical Skills: Code Review & Best Practices; Portfolio / Personal Project Feedback

Only place exact strings from that list in adviceTopics. Put technologies and other concepts in techTerms, roleInterest, careerStage, or freeTextNeed.

Related product needs are not interchangeable:
- CV review is not an HR interview.
- LinkedIn review is not CV review.
- Technical mock interviews are not behavioral interviews.
- System design is not a generic coding interview.
- Portfolio feedback is not code review.

Examples:
- "Can someone help me improve my resume?" -> find_mentor, ["CV / Resume Review"], freeTextNeed "improve resume".
- "אני רוצה שמישהי תעבור איתי על קורות החיים" -> find_mentor, ["CV / Resume Review"].
- "Improve my LinkedIn profile and About section" -> ["LinkedIn Profile Review"].
- "I want to practice coding interviews" or "LeetCode interview practice" -> ["Technical Mock Interviews"].
- "Practice tell me about yourself and strengths and weaknesses" -> ["HR / Behavioral Mock Interviews"].
- "Prepare for system design interviews" -> ["System Design Interviews"].
- "Review my Node.js code for good practices" -> ["Code Review & Best Practices"], techTerms ["Node.js"].
- "Feedback on personal projects before my first job" -> ["Portfolio / Personal Project Feedback"], careerStage "first_job".
- "I want a backend mentor who knows Python" -> no required built-in topic, techTerms ["Python"], roleInterest "backend".
- "I need help" -> clarification_needed.
- "What is the weather?" -> out_of_scope.`;

function normalizeQuery(query) {
  if (typeof query !== "string" || !query.trim()) {
    throw new TypeError("query must be a non-empty string");
  }
  const normalized = query.trim().replace(/\s+/g, " ");
  if (normalized.length > MAX_QUERY_LENGTH) {
    throw new TypeError(
      `query must contain at most ${MAX_QUERY_LENGTH} characters`
    );
  }
  return normalized;
}

function isShortString(value, maxLength) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value === value.trim()
  );
}

function isUniqueStringArray(value, { allowedValues, maxItems, maxLength }) {
  if (!Array.isArray(value) || value.length > maxItems) return false;
  if (
    !value.every(
      (item) =>
        isShortString(item, maxLength) &&
        (!allowedValues || allowedValues.includes(item))
    )
  ) {
    return false;
  }
  return new Set(value).size === value.length;
}

function validateMentorSearchUnderstanding(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (
    keys.length !== RESULT_FIELDS.length ||
    !RESULT_FIELDS.every((field) => keys.includes(field))
  ) {
    return false;
  }

  return (
    MENTOR_SEARCH_INTENTS.includes(value.intent) &&
    isUniqueStringArray(value.adviceTopics, {
      allowedValues: BUILT_IN_ADVICE_TOPICS,
      maxItems: BUILT_IN_ADVICE_TOPICS.length,
      maxLength: MAX_TOPIC_LENGTH,
    }) &&
    isUniqueStringArray(value.techTerms, {
      maxItems: MAX_TECH_TERMS,
      maxLength: MAX_TECH_TERM_LENGTH,
    }) &&
    (value.roleInterest === null ||
      isShortString(value.roleInterest, MAX_ROLE_LENGTH)) &&
    (value.careerStage === null || CAREER_STAGES.includes(value.careerStage)) &&
    typeof value.freeTextNeed === "string" &&
    value.freeTextNeed.length <= MAX_FREE_TEXT_NEED_LENGTH &&
    value.freeTextNeed === value.freeTextNeed.trim()
  );
}

const MAX_TOPIC_LENGTH = Math.max(
  ...BUILT_IN_ADVICE_TOPICS.map((topic) => topic.length)
);

function invalidStructuredOutputError(cause) {
  return new Error("Query understanding provider returned invalid structured output", {
    cause,
  });
}

function parseStructuredResponse(response) {
  const responseText =
    typeof response?.text === "function" ? response.text() : response?.text;
  if (typeof responseText !== "string") {
    throw invalidStructuredOutputError();
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw invalidStructuredOutputError(error);
  }
  if (!validateMentorSearchUnderstanding(parsed)) {
    throw invalidStructuredOutputError();
  }
  return parsed;
}

function readQueryUnderstandingConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required for mentor query understanding"
    );
  }
  return { apiKey };
}

async function generateContentWithGemini(request) {
  const { apiKey } = readQueryUnderstandingConfig();
  try {
    return await new GoogleGenAI({ apiKey }).models.generateContent(request);
  } catch (error) {
    throw new Error("Query understanding provider request failed", {
      cause: error,
    });
  }
}

function createMentorQueryUnderstandingService({
  generateContent = generateContentWithGemini,
} = {}) {
  async function understandMentorSearchQuery(query) {
    const normalizedQuery = normalizeQuery(query);
    const model =
      process.env.GEMINI_QUERY_UNDERSTANDING_MODEL?.trim() ||
      DEFAULT_QUERY_UNDERSTANDING_MODEL;
    const response = await generateContent({
      model,
      contents: normalizedQuery,
      config: {
        systemInstruction: DOMAIN_INSTRUCTION,
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: QUERY_UNDERSTANDING_SCHEMA,
      },
    });
    return parseStructuredResponse(response);
  }

  return { understandMentorSearchQuery };
}

const defaultService = createMentorQueryUnderstandingService();

module.exports = {
  DEFAULT_QUERY_UNDERSTANDING_MODEL,
  MAX_QUERY_LENGTH,
  QUERY_UNDERSTANDING_SCHEMA,
  createMentorQueryUnderstandingService,
  understandMentorSearchQuery: defaultService.understandMentorSearchQuery,
  validateMentorSearchUnderstanding,
};
