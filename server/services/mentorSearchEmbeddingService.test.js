const {
  createMentorSearchEmbeddingRepository,
  createMentorSearchEmbeddingService,
  hashMentorSearchDocument,
} = require("./mentorSearchEmbeddingService");

const mentor = {
  id: "11111111-1111-4111-8111-111111111111",
  background: "Backend engineer",
  adviceTopics: ["System Design", "Mock Interviews"],
  user: {
    job: "Staff Engineer",
    workplace: "QueenB",
    techStack: ["Node.js", "PostgreSQL"],
  },
};

function createHarness({ current = null, foundMentor = mentor } = {}) {
  const prismaClient = {
    mentorProfile: { findUnique: jest.fn().mockResolvedValue(foundMentor) },
  };
  const repository = {
    findCurrentMetadata: jest.fn().mockResolvedValue(current),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  const embedding = Array(768).fill(0);
  embedding[0] = 1;
  const embedSearchDocument = jest.fn().mockResolvedValue(embedding);
  const getEmbeddingMetadata = jest.fn(() => ({
    model: "gemini-embedding-001",
    dimensions: 768,
  }));
  const service = createMentorSearchEmbeddingService({
    prismaClient,
    repository,
    embedSearchDocument,
    getEmbeddingMetadata,
  });

  return {
    service,
    prismaClient,
    repository,
    embedSearchDocument,
    embedding,
  };
}

describe("mentorSearchEmbeddingService", () => {
  it("loads every mentor and user field used by the search document", async () => {
    const { service, prismaClient } = createHarness();

    await service.generateMentorSearchEmbedding(mentor.id);

    expect(prismaClient.mentorProfile.findUnique).toHaveBeenCalledWith({
      where: { id: mentor.id },
      select: {
        id: true,
        background: true,
        adviceTopics: true,
        user: {
          select: { job: true, workplace: true, techStack: true },
        },
      },
    });
  });

  it("passes the exact built mentor document to the document embedding API", async () => {
    const { service, embedSearchDocument } = createHarness();

    await service.generateMentorSearchEmbedding(mentor.id);

    expect(embedSearchDocument).toHaveBeenCalledWith(
      [
        "Background: Backend engineer",
        "Advice topics: System Design, Mock Interviews",
        "Job: Staff Engineer",
        "Workplace: QueenB",
        "Tech stack: Node.js, PostgreSQL",
      ].join("\n")
    );
  });

  it("produces a stable SHA-256 hash of the exact document", () => {
    const document = "Background: Backend engineer\nTech stack: Node.js";

    expect(hashMentorSearchDocument(document)).toBe(
      hashMentorSearchDocument(document)
    );
    expect(hashMentorSearchDocument(document)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMentorSearchDocument(`${document} `)).not.toBe(
      hashMentorSearchDocument(document)
    );
  });

  it("skips re-embedding when hash, model, and dimensions are unchanged", async () => {
    const document = [
      "Background: Backend engineer",
      "Advice topics: System Design, Mock Interviews",
      "Job: Staff Engineer",
      "Workplace: QueenB",
      "Tech stack: Node.js, PostgreSQL",
    ].join("\n");
    const { service, embedSearchDocument, repository } = createHarness({
      current: {
        documentHash: hashMentorSearchDocument(document),
        model: "gemini-embedding-001",
        dimensions: 768,
      },
    });

    const result = await service.generateMentorSearchEmbedding(mentor.id);

    expect(result).toEqual({
      mentorProfileId: mentor.id,
      updated: false,
      dimensions: 768,
      model: "gemini-embedding-001",
    });
    expect(embedSearchDocument).not.toHaveBeenCalled();
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("re-embeds and upserts when the document changed", async () => {
    const { service, embedSearchDocument, repository } = createHarness({
      current: {
        documentHash: hashMentorSearchDocument("old document"),
        model: "gemini-embedding-001",
        dimensions: 768,
      },
    });

    const result = await service.generateMentorSearchEmbedding(mentor.id);

    expect(embedSearchDocument).toHaveBeenCalledTimes(1);
    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        mentorProfileId: mentor.id,
        documentText: expect.stringContaining("Tech stack: Node.js, PostgreSQL"),
        documentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        model: "gemini-embedding-001",
        dimensions: 768,
      })
    );
    expect(result).toEqual({
      mentorProfileId: mentor.id,
      updated: true,
      dimensions: 768,
      model: "gemini-embedding-001",
    });
  });

  it("stores the embedding and metadata but never returns the vector", async () => {
    const { service, repository, embedding } = createHarness();

    const result = await service.generateMentorSearchEmbedding(mentor.id);

    expect(repository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ embedding })
    );
    expect(result).not.toHaveProperty("embedding");
    expect(JSON.stringify(result)).not.toContain("[1,0,0");
  });

  it("does not overwrite an existing embedding when generation fails", async () => {
    const { service, embedSearchDocument, repository } = createHarness({
      current: {
        documentHash: hashMentorSearchDocument("old document"),
        model: "gemini-embedding-001",
        dimensions: 768,
      },
    });
    embedSearchDocument.mockRejectedValue(new Error("provider unavailable"));

    await expect(
      service.generateMentorSearchEmbedding(mentor.id)
    ).rejects.toThrow("provider unavailable");
    expect(repository.upsert).not.toHaveBeenCalled();
  });

  it("returns a not-found error when the mentor profile does not exist", async () => {
    const { service, repository, embedSearchDocument } = createHarness({
      foundMentor: null,
    });

    await expect(
      service.generateMentorSearchEmbedding(mentor.id)
    ).rejects.toMatchObject({
      message: "Mentor profile not found",
      statusCode: 404,
      code: "NOT_FOUND",
    });
    expect(embedSearchDocument).not.toHaveBeenCalled();
    expect(repository.findCurrentMetadata).not.toHaveBeenCalled();
  });
});

describe("mentor search embedding repository", () => {
  const record = {
    mentorProfileId: mentor.id,
    embedding: [1, ...Array(767).fill(0)],
    documentText: "Background: Backend engineer",
    documentHash: hashMentorSearchDocument("Background: Backend engineer"),
    model: "gemini-embedding-001",
    dimensions: 768,
  };

  it("binds the validated vector literal and metadata as raw-SQL parameters", async () => {
    const prismaClient = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const repository = createMentorSearchEmbeddingRepository(prismaClient);

    await repository.upsert(record);

    const [sql, ...boundValues] = prismaClient.$executeRaw.mock.calls[0];
    expect(sql.join("?")).toContain("INSERT INTO \"mentor_search_embeddings\"");
    expect(boundValues).toEqual([
      record.mentorProfileId,
      `[${record.embedding.join(",")}]`,
      record.documentText,
      record.documentHash,
      record.model,
      768,
    ]);
  });

  it("rejects any vector that is not exactly 768-dimensional even if metadata agrees", async () => {
    const prismaClient = { $executeRaw: jest.fn() };
    const repository = createMentorSearchEmbeddingRepository(prismaClient);

    await expect(
      repository.upsert({
        ...record,
        embedding: Array(767).fill(1),
        dimensions: 767,
      })
    ).rejects.toThrow("Embedding dimensions must be exactly 768");
    expect(prismaClient.$executeRaw).not.toHaveBeenCalled();
  });
});
