const mockEmbedContent = jest.fn();
const mockGoogleGenAI = jest.fn(() => ({
  models: { embedContent: mockEmbedContent },
}));

jest.mock("@google/genai", () => ({ GoogleGenAI: mockGoogleGenAI }));

const { embedText } = require("./embeddingService");

describe("embedText", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_EMBEDDING_MODEL;

  beforeEach(() => {
    mockEmbedContent.mockReset();
    mockGoogleGenAI.mockClear();
    process.env.GEMINI_API_KEY = "test-api-key";
    delete process.env.GEMINI_EMBEDDING_MODEL;
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.GEMINI_EMBEDDING_MODEL;
    } else {
      process.env.GEMINI_EMBEDDING_MODEL = originalModel;
    }
  });

  it("returns only the numeric vector using normalized text and the default model", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.12, -0.34, 0.56] }],
    });

    await expect(embedText("  mentor\n  matching  ")).resolves.toEqual([
      0.12,
      -0.34,
      0.56,
    ]);
    expect(mockGoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" });
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
      contents: "mentor matching",
      config: { taskType: "SEMANTIC_SIMILARITY" },
    });
  });

  it("uses the configured model override", async () => {
    process.env.GEMINI_EMBEDDING_MODEL = "custom-embedding-model";
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2] }],
    });

    await embedText("mentor matching");

    expect(mockEmbedContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: "custom-embedding-model" })
    );
  });

  it.each(["", "   \n\t ", null, undefined, 42, {}])(
    "rejects empty or invalid input (%p) without calling Gemini",
    async (input) => {
      await expect(embedText(input)).rejects.toThrow(
        "Embedding text must be a non-empty string"
      );
      expect(mockGoogleGenAI).not.toHaveBeenCalled();
      expect(mockEmbedContent).not.toHaveBeenCalled();
    }
  );

  it("rejects a missing API key without calling Gemini", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(embedText("mentor matching")).rejects.toThrow(
      "GEMINI_API_KEY is required to create embeddings"
    );
    expect(mockGoogleGenAI).not.toHaveBeenCalled();
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("surfaces Gemini provider failures", async () => {
    mockEmbedContent.mockRejectedValue(new Error("quota exceeded"));

    await expect(embedText("mentor matching")).rejects.toThrow(
      "Embedding provider request failed"
    );
  });

  it.each([{}, { embeddings: [] }])(
    "rejects a response with missing embeddings (%p)",
    async (response) => {
      mockEmbedContent.mockResolvedValue(response);

      await expect(embedText("mentor matching")).rejects.toThrow(
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

    await expect(embedText("mentor matching")).rejects.toThrow(
      "Embedding provider returned a malformed response"
    );
  });
});
