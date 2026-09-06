process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../services/embeddingService", () => ({
  embedSearchQuery: jest.fn(),
}));
jest.mock("../services/mentorSearchEmbeddingService", () => ({
  generateMentorSearchEmbedding: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");
const { embedSearchQuery } = require("../services/embeddingService");
const {
  generateMentorSearchEmbedding,
} = require("../services/mentorSearchEmbeddingService");

const mentorProfileId = "11111111-1111-4111-8111-111111111111";

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET);
}

const app = createApp({
  jwtSecret: process.env.JWT_SECRET,
  notifications: {
    notificationRepository: { listForUser: async () => [] },
    realtimeHub: { subscribe: () => () => {}, publish() {} },
  },
  userRepository: {
    findPublicById: async (userId) => ({
      id: userId,
      roles: userId === "admin-user" ? ["admin"] : ["mentee"],
    }),
  },
});

describe("POST /api/mentor-search/embedding", () => {
  beforeEach(() => {
    embedSearchQuery.mockReset();
  });

  it("returns only the embedding dimension", async () => {
    embedSearchQuery.mockResolvedValue([0.1, 0.2, 0.3]);

    const response = await request(app)
      .post("/api/mentor-search/embedding")
      .set("Authorization", `Bearer ${tokenFor("user-1")}`)
      .send({ query: "  I need help preparing for a backend interview  " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, dimension: 3 });
    expect(embedSearchQuery).toHaveBeenCalledWith(
      "I need help preparing for a backend interview"
    );
    expect(response.body).not.toHaveProperty("embedding");
  });

  it.each([
    ["missing", {}],
    ["empty", { query: "" }],
    ["whitespace-only", { query: "   \n\t " }],
    ["non-string", { query: 42 }],
  ])("rejects a %s query", async (_, body) => {
    const response = await request(app)
      .post("/api/mentor-search/embedding")
      .set("Authorization", `Bearer ${tokenFor("user-1")}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(embedSearchQuery).not.toHaveBeenCalled();
  });

  it("uses the standard error response when the provider fails", async () => {
    embedSearchQuery.mockRejectedValue(new Error("Gemini provider details"));

    const response = await request(app)
      .post("/api/mentor-search/embedding")
      .set("Authorization", `Bearer ${tokenFor("user-1")}`)
      .send({ query: "backend interview preparation" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("Gemini");
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .post("/api/mentor-search/embedding")
      .send({ query: "backend interview preparation" });

    expect(response.status).toBe(401);
    expect(embedSearchQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/mentor-search/admin/mentor-embedding", () => {
  beforeEach(() => {
    generateMentorSearchEmbedding.mockReset();
  });

  it("rejects unauthenticated requests", async () => {
    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .send({ mentorProfileId });

    expect(response.status).toBe(401);
    expect(generateMentorSearchEmbedding).not.toHaveBeenCalled();
  });

  it("rejects users whose current database role is not admin", async () => {
    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .set("Authorization", `Bearer ${tokenFor("mentee-user", ["admin"])}`)
      .send({ mentorProfileId });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(generateMentorSearchEmbedding).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", {}],
    ["invalid", { mentorProfileId: "not-a-uuid" }],
  ])("rejects a %s mentorProfileId", async (_, body) => {
    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .set("Authorization", `Bearer ${tokenFor("admin-user", ["admin"])}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(generateMentorSearchEmbedding).not.toHaveBeenCalled();
  });

  it("returns 404 when the mentor profile does not exist", async () => {
    generateMentorSearchEmbedding.mockRejectedValue(
      Object.assign(new Error("Mentor profile not found"), {
        statusCode: 404,
        code: "NOT_FOUND",
      })
    );

    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .set("Authorization", `Bearer ${tokenFor("admin-user", ["admin"])}`)
      .send({ mentorProfileId });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: "Mentor profile not found" },
    });
    expect(generateMentorSearchEmbedding).toHaveBeenCalledWith(mentorProfileId);
  });

  it("generates the embedding and returns metadata only", async () => {
    generateMentorSearchEmbedding.mockResolvedValue({
      mentorProfileId,
      updated: true,
      dimensions: 768,
      model: "gemini-embedding-001",
      embedding: [0.1, 0.2, 0.3],
      documentText: "private mentor search document",
      apiKey: "private-api-key",
      rawResponse: { embeddings: [{ values: [0.1, 0.2, 0.3] }] },
    });

    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .set("Authorization", `Bearer ${tokenFor("admin-user", ["admin"])}`)
      .send({ mentorProfileId });

    expect(response.status).toBe(200);
    expect(generateMentorSearchEmbedding).toHaveBeenCalledWith(mentorProfileId);
    expect(response.body).toEqual({
      mentorProfileId,
      updated: true,
      dimensions: 768,
      model: "gemini-embedding-001",
    });
    expect(response.body).not.toHaveProperty("embedding");
    expect(response.body).not.toHaveProperty("documentText");
    expect(response.body).not.toHaveProperty("apiKey");
    expect(response.body).not.toHaveProperty("rawResponse");
    expect(JSON.stringify(response.body)).not.toContain("0.1");
  });

  it("returns updated false when the stored embedding is unchanged", async () => {
    generateMentorSearchEmbedding.mockResolvedValue({
      mentorProfileId,
      updated: false,
      dimensions: 768,
      model: "gemini-embedding-001",
    });

    const response = await request(app)
      .post("/api/mentor-search/admin/mentor-embedding")
      .set("Authorization", `Bearer ${tokenFor("admin-user", ["admin"])}`)
      .send({ mentorProfileId });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mentorProfileId,
      updated: false,
      dimensions: 768,
      model: "gemini-embedding-001",
    });
  });
});
