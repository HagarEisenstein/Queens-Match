const {
  createMentorSemanticSearchRepository,
  createMentorSemanticSearchService,
} = require("./mentorSemanticSearchService");

const queryEmbedding = [1, ...Array(767).fill(0)];
const databaseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  background: "Backend engineer and interview coach",
  adviceTopics: ["Backend Development", "CV / Resume Review"],
  meetingsOffered: 3,
  meetingLengthMinutes: 45,
  userId: "22222222-2222-4222-8222-222222222222",
  username: "ada",
  fullName: "Ada Mentor",
  photoUrl: "https://example.com/ada.jpg",
  job: "Staff Engineer",
  workplace: "QueenB",
  techStack: ["Node.js", "PostgreSQL"],
  semanticScore: 0.875,
};

function createHarness(rows = [databaseRow]) {
  const repository = {
    findNearest: jest.fn().mockResolvedValue(rows),
  };
  const embedSearchQuery = jest.fn().mockResolvedValue(queryEmbedding);
  const service = createMentorSemanticSearchService({
    repository,
    embedSearchQuery,
  });
  return { service, repository, embedSearchQuery };
}

describe("mentor semantic search service", () => {
  it("embeds trimmed query text and returns the mentor card shape with a score", async () => {
    const { service, repository, embedSearchQuery } = createHarness();

    const result = await service.searchMentorsBySemanticQuery(
      "  backend interview and CV help  "
    );

    expect(embedSearchQuery).toHaveBeenCalledWith(
      "backend interview and CV help"
    );
    expect(repository.findNearest).toHaveBeenCalledWith(
      `[${queryEmbedding.join(",")}]`,
      5
    );
    expect(result).toEqual([
      {
        id: databaseRow.id,
        background: databaseRow.background,
        adviceTopics: databaseRow.adviceTopics,
        meetingsOffered: 3,
        meetingLengthMinutes: 45,
        user: {
          id: databaseRow.userId,
          username: "ada",
          fullName: "Ada Mentor",
          photoUrl: "https://example.com/ada.jpg",
          job: "Staff Engineer",
          workplace: "QueenB",
          techStack: ["Node.js", "PostgreSQL"],
        },
        semanticScore: 0.875,
      },
    ]);
  });

  it.each([null, "", "   ", 42])(
    "rejects invalid query input %p before embedding",
    async (query) => {
      const { service, repository, embedSearchQuery } = createHarness();

      await expect(service.searchMentorsBySemanticQuery(query)).rejects.toThrow(
        "query must be a non-empty string"
      );
      expect(embedSearchQuery).not.toHaveBeenCalled();
      expect(repository.findNearest).not.toHaveBeenCalled();
    }
  );

  it.each([
    [Array(767).fill(1)],
    [[...Array(767).fill(1), Number.NaN]],
    [[...Array(767).fill(1), Number.POSITIVE_INFINITY]],
    ["not-a-vector"],
  ])("rejects malformed query embeddings before SQL", async (embedding) => {
    const { service, repository, embedSearchQuery } = createHarness();
    embedSearchQuery.mockResolvedValue(embedding);

    await expect(
      service.searchMentorsBySemanticQuery("backend help")
    ).rejects.toThrow("Embedding must contain exactly 768 finite numbers");
    expect(repository.findNearest).not.toHaveBeenCalled();
  });

  it("returns an empty list when no stored mentor embeddings match", async () => {
    const { service } = createHarness([]);

    await expect(
      service.searchMentorsBySemanticQuery("backend help")
    ).resolves.toEqual([]);
  });

  it("supports a bounded internal result limit", async () => {
    const { service, repository } = createHarness([]);

    await service.searchMentorsBySemanticQuery("backend help", { limit: 100 });

    expect(repository.findNearest).toHaveBeenCalledWith(expect.any(String), 20);
  });

  it("rejects a non-finite score instead of returning malformed data", async () => {
    const { service } = createHarness([
      { ...databaseRow, semanticScore: "not-a-number" },
    ]);

    await expect(
      service.searchMentorsBySemanticQuery("backend help")
    ).rejects.toThrow("Semantic search returned an invalid score");
  });
});

describe("mentor semantic search repository", () => {
  it("uses bound vector and limit values with pgvector cosine distance", async () => {
    const prismaClient = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const repository = createMentorSemanticSearchRepository(prismaClient);
    const vectorLiteral = `[${queryEmbedding.join(",")}]`;

    await repository.findNearest(vectorLiteral, 5);

    const [sql, ...boundValues] = prismaClient.$queryRaw.mock.calls[0];
    const sqlText = sql.join("?");
    expect(sqlText).toContain("FROM \"mentor_search_embeddings\"");
    expect(sqlText).toContain("JOIN \"mentor_profiles\"");
    expect(sqlText).toContain("JOIN \"users\"");
    expect(sqlText).toContain("1 -");
    expect(sqlText).toContain("<=>");
    expect(sqlText).toMatch(/ORDER BY[\s\S]*<=>[\s\S]*ASC/);
    expect(sqlText).toContain("LIMIT ?");
    expect(boundValues).toEqual([vectorLiteral, 5]);
  });
});
