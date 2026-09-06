process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../services/embeddingService", () => ({
  embedSearchQuery: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");
const { embedSearchQuery } = require("../services/embeddingService");

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET);
}

const app = createApp({
  jwtSecret: process.env.JWT_SECRET,
  notifications: {
    notificationRepository: { listForUser: async () => [] },
    realtimeHub: { subscribe: () => () => {}, publish() {} },
  },
  userRepository: { findPublicById: async () => null },
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
