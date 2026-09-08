const {
  buildMentorSearchDocument,
} = require("./mentorSearchDocument");

describe("buildMentorSearchDocument", () => {
  it("builds a normalized document from the complete mentor profile shape", () => {
    const mentor = {
      background: "Backend engineer with 8 years of experience",
      adviceTopics: [
        "System Design Interviews",
        "Technical Mock Interviews",
      ],
      user: {
        job: "Senior Backend Engineer",
        workplace: "Wix",
        techStack: ["Node.js", "PostgreSQL"],
      },
    };

    expect(buildMentorSearchDocument(mentor)).toBe(
      [
        "Background: Backend engineer with 8 years of experience",
        "Advice topics: System Design Interviews, Technical Mock Interviews",
        "Job: Senior Backend Engineer",
        "Workplace: Wix",
        "Tech stack: Node.js, PostgreSQL",
      ].join("\n")
    );
  });

  it("normalizes whitespace and removes empty or duplicate list values", () => {
    const mentor = {
      background: "  Backend\n engineer  ",
      adviceTopics: [
        " System   Design ",
        "system design",
        "",
        null,
        " Mock Interviews ",
      ],
      user: {
        job: "  Staff   Engineer ",
        workplace: null,
        techStack: [" Node.js ", "node.js", "  ", undefined],
      },
    };

    expect(buildMentorSearchDocument(mentor)).toBe(
      [
        "Background: Backend engineer",
        "Advice topics: System Design, Mock Interviews",
        "Job: Staff Engineer",
        "Tech stack: Node.js",
      ].join("\n")
    );
  });

  it("safely ignores missing and invalid optional fields", () => {
    expect(buildMentorSearchDocument({ adviceTopics: "not-an-array" })).toBe("");
    expect(buildMentorSearchDocument(null)).toBe("");
  });

  it("is deterministic and does not mutate the mentor object", () => {
    const mentor = {
      background: " Backend engineer ",
      adviceTopics: [" System Design ", "system design"],
      user: { techStack: [" Node.js "] },
    };
    const original = JSON.parse(JSON.stringify(mentor));

    const firstDocument = buildMentorSearchDocument(mentor);

    expect(buildMentorSearchDocument(mentor)).toBe(firstDocument);
    expect(mentor).toEqual(original);
  });
});
