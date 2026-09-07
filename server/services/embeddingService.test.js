const mockEmbedContent = jest.fn();
const mockGoogleGenAI = jest.fn(() => ({
  models: { embedContent: mockEmbedContent },
}));

jest.mock("@google/genai", () => ({ GoogleGenAI: mockGoogleGenAI }));

const {
  EMBEDDING_DIMENSIONS,
  embedSearchDocument,
  embedSearchQuery,
  getEmbeddingMetadata,
} = require("./embeddingService");

function vectorWithNormFive() {
  return [3, 4, ...Array(EMBEDDING_DIMENSIONS - 2).fill(0)];
}

describe("embeddingService", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_EMBEDDING_MODEL;
  const originalDimensions = process.env.GEMINI_EMBEDDING_DIMENSIONS;

  beforeEach(() => {
    mockEmbedContent.mockReset();
    mockGoogleGenAI.mockClear();
    process.env.GEMINI_API_KEY = "test-api-key";
    delete process.env.GEMINI_EMBEDDING_MODEL;
    delete process.env.GEMINI_EMBEDDING_DIMENSIONS;
  });

  afterAll(() => {
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("GEMINI_API_KEY", originalApiKey);
    restore("GEMINI_EMBEDDING_MODEL", originalModel);
    restore("GEMINI_EMBEDDING_DIMENSIONS", originalDimensions);
  });

  it("embeds mentor documents with RETRIEVAL_DOCUMENT at 768 dimensions", async () => {
    const document = [
      "Background: Backend engineer",
      "Tech stack: Node.js, PostgreSQL",
    ].join("\n");
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: vectorWithNormFive() }],
    });

    const embedding = await embedSearchDocument(document);

    expect(embedding).toHaveLength(768);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: document,
      config: {
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
      },
    });
  });

  it("embeds searches with RETRIEVAL_QUERY without exposing provider task strings", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: vectorWithNormFive() }],
    });

    await embedSearchQuery("backend interview preparation");

    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: 768,
        },
      })
    );
  });

  it("normalizes a valid vector to approximately unit L2 norm", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: vectorWithNormFive() }],
    });

    const embedding = await embedSearchDocument("mentor profile");
    const norm = Math.sqrt(
      embedding.reduce((sum, value) => sum + value * value, 0)
    );

    expect(embedding[0]).toBeCloseTo(0.6);
    expect(embedding[1]).toBeCloseTo(0.8);
    expect(norm).toBeCloseTo(1, 12);
  });

  it("reports the configured model and fixed database dimension without requiring an API key", () => {
    delete process.env.GEMINI_API_KEY;
    process.env.GEMINI_EMBEDDING_MODEL = "configured-model";

    expect(getEmbeddingMetadata()).toEqual({
      model: "configured-model",
      dimensions: 768,
    });
  });

  it.each(["", "   \n\t ", null, undefined, 42, {}])(
    "rejects empty or invalid input (%p) without calling Gemini",
    async (input) => {
      await expect(embedSearchDocument(input)).rejects.toThrow(
        "Embedding text must be a non-empty string"
      );
      expect(mockGoogleGenAI).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing API key without calling Gemini", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "GEMINI_API_KEY is required to create embeddings"
    );
    expect(mockGoogleGenAI).not.toHaveBeenCalled();
  });

  it("fails fast when runtime dimensions conflict with vector(768)", async () => {
    process.env.GEMINI_EMBEDDING_DIMENSIONS = "3072";

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "GEMINI_EMBEDDING_DIMENSIONS must be exactly 768"
    );
    expect(mockGoogleGenAI).not.toHaveBeenCalled();
  });

  it("surfaces Gemini provider failures", async () => {
    mockEmbedContent.mockRejectedValue(new Error("quota exceeded"));

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "Embedding provider request failed"
    );
  });

  it.each([{}, { embeddings: [] }])(
    "rejects a response with missing embeddings (%p)",
    async (response) => {
      mockEmbedContent.mockResolvedValue(response);

      await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
        "Embedding provider returned no embeddings"
      );
    }
  );

  it.each([
    { embeddings: [{}] },
    { embeddings: [{ values: [] }] },
    { embeddings: [{ values: [0.1, "invalid"] }] },
    { embeddings: [{ values: [0.1, Number.NaN] }] },
  ])("rejects a malformed numeric vector (%p)", async (response) => {
    mockEmbedContent.mockResolvedValue(response);

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "Embedding provider returned a malformed response"
    );
  });

  it("rejects a numeric vector with the wrong dimension", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: Array(767).fill(1) }],
    });

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "Embedding provider returned 767 dimensions; expected 768"
    );
  });

  it("rejects a zero-norm vector", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: Array(768).fill(0) }],
    });

    await expect(embedSearchDocument("mentor profile")).rejects.toThrow(
      "Embedding provider returned a vector with an invalid L2 norm"
    );
  });
});
