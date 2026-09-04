process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../services/mentorProfilesService", () => ({
  getMentors: jest.fn(),
  getMentorById: jest.fn(),
  getMentorByUserId: jest.fn(),
  upsertMentorProfile: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");
const {
  getMentors,
  getMentorById,
  getMentorByUserId,
  upsertMentorProfile,
} = require("../services/mentorProfilesService");

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET);
}

const stubNotifications = {
  notificationRepository: {
    listForUser: async () => [],
  },
  realtimeHub: {
    subscribe() {
      return () => {};
    },
    publish() {},
  },
};

const app = createApp({
  jwtSecret: process.env.JWT_SECRET,
  notifications: stubNotifications,
  userRepository: {
    findPublicById: async () => null,
  },
});

const validProfile = {
  background: "10 years in backend engineering.",
  adviceTopics: ["career planning", "mock interviews"],
  meetingsOffered: 3,
  meetingLengthMinutes: 30,
};

describe("mentors routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/mentors", () => {
    it("is public and returns the mentor list", async () => {
      getMentors.mockResolvedValue([{ id: "m1" }]);

      const response = await request(app).get("/api/mentors");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: "m1" }]);
    });

    it("forwards service errors to the standard error shape", async () => {
      getMentors.mockRejectedValue(
        Object.assign(new Error("boom"), { statusCode: 500 })
      );

      const response = await request(app).get("/api/mentors");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        },
      });
    });
  });

  describe("GET /api/mentors/:id", () => {
    it("returns the profile when found", async () => {
      getMentorById.mockResolvedValue({ id: "m1", ...validProfile });

      const response = await request(app).get("/api/mentors/m1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: "m1", ...validProfile });
      expect(getMentorById).toHaveBeenCalledWith("m1");
    });

    it("returns 404 with the standard error shape when missing", async () => {
      getMentorById.mockResolvedValue(null);

      const response = await request(app).get("/api/mentors/missing");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { code: "NOT_FOUND", message: "Mentor profile not found" },
      });
    });

    it("forwards unexpected service errors to the standard error shape", async () => {
      getMentorById.mockRejectedValue(
        Object.assign(new Error("boom"), { statusCode: 500 })
      );

      const response = await request(app).get("/api/mentors/m1");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      });
    });
  });

  describe("GET /api/mentors/me", () => {
    it("rejects an unauthenticated request", async () => {
      const response = await request(app).get("/api/mentors/me");

      expect(response.status).toBe(401);
      expect(getMentorByUserId).not.toHaveBeenCalled();
    });

    it("rejects an invalid token", async () => {
      const response = await request(app)
        .get("/api/mentors/me")
        .set("Authorization", "Bearer not-a-real-token");

      expect(response.status).toBe(401);
    });

    it("returns an empty state when the authenticated mentor has no profile yet", async () => {
      getMentorByUserId.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1", ["mentor"])}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
      expect(getMentorByUserId).toHaveBeenCalledWith("u1");
    });

    it("returns the caller's own profile when authenticated", async () => {
      getMentorByUserId.mockResolvedValue({ userId: "u1", ...validProfile });

      const response = await request(app)
        .get("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1", ["mentor"])}`);

      expect(response.status).toBe(200);
      expect(getMentorByUserId).toHaveBeenCalledWith("u1");
      expect(response.body).toEqual({ userId: "u1", ...validProfile });
    });

    it("returns null when the caller has no mentor profile yet", async () => {
      getMentorByUserId.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1", ["mentor"])}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it("forwards unexpected service errors to the standard error shape", async () => {
      getMentorByUserId.mockRejectedValue(
        Object.assign(new Error("boom"), { statusCode: 500 })
      );

      const response = await request(app)
        .get("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      });
    });
  });

  describe("PUT /api/mentors/me", () => {
    it("rejects an unauthenticated request", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .send(validProfile);

      expect(response.status).toBe(401);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("rejects an incomplete profile with a validation error", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ background: "" });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("rejects an empty advice-topics list", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, adviceTopics: [] });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("rejects a meeting length outside the allowed range", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, meetingLengthMinutes: 5 });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("rejects a meeting length above the allowed maximum", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, meetingLengthMinutes: 481 });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it.each([15, 480])(
      "accepts a meeting length at the boundary (%i minutes)",
      async (meetingLengthMinutes) => {
        upsertMentorProfile.mockResolvedValue({ userId: "u1", ...validProfile, meetingLengthMinutes });

        const response = await request(app)
          .put("/api/mentors/me")
          .set("Authorization", `Bearer ${tokenFor("u1")}`)
          .send({ ...validProfile, meetingLengthMinutes });

        expect(response.status).toBe(200);
        expect(upsertMentorProfile).toHaveBeenCalledWith(
          "u1",
          expect.objectContaining({ meetingLengthMinutes })
        );
      }
    );

    it("rejects a meetings-offered count above the allowed maximum", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, meetingsOffered: 1001 });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("rejects a meetings-offered count below the allowed minimum", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, meetingsOffered: 0 });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it.each([1, 1000])(
      "accepts a meetings-offered count at the boundary (%i)",
      async (meetingsOffered) => {
        upsertMentorProfile.mockResolvedValue({ userId: "u1", ...validProfile, meetingsOffered });

        const response = await request(app)
          .put("/api/mentors/me")
          .set("Authorization", `Bearer ${tokenFor("u1")}`)
          .send({ ...validProfile, meetingsOffered });

        expect(response.status).toBe(200);
        expect(upsertMentorProfile).toHaveBeenCalledWith(
          "u1",
          expect.objectContaining({ meetingsOffered })
        );
      }
    );

    it("rejects an advice topic longer than the allowed maximum", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, adviceTopics: ["a".repeat(101)] });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("accepts an advice topic at the maximum allowed length", async () => {
      const topic = "a".repeat(100);
      upsertMentorProfile.mockResolvedValue({ userId: "u1", ...validProfile, adviceTopics: [topic] });

      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, adviceTopics: [topic] });

      expect(response.status).toBe(200);
      expect(upsertMentorProfile).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ adviceTopics: [topic] })
      );
    });

    it("rejects a background longer than the allowed maximum", async () => {
      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({ ...validProfile, background: "a".repeat(5001) });

      expect(response.status).toBe(400);
      expect(upsertMentorProfile).not.toHaveBeenCalled();
    });

    it("forwards unexpected service errors to the standard error shape", async () => {
      upsertMentorProfile.mockRejectedValue(
        Object.assign(new Error("boom"), { statusCode: 500 })
      );

      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send(validProfile);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
      });
    });

    it("saves a valid profile, trimming free-text fields", async () => {
      upsertMentorProfile.mockResolvedValue({ userId: "u1", ...validProfile });

      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u1")}`)
        .send({
          background: `  ${validProfile.background}  `,
          adviceTopics: ["  career planning ", "mock interviews"],
          meetingsOffered: validProfile.meetingsOffered,
          meetingLengthMinutes: validProfile.meetingLengthMinutes,
        });

      expect(response.status).toBe(200);
      expect(upsertMentorProfile).toHaveBeenCalledWith("u1", validProfile);
      expect(response.body).toEqual({ userId: "u1", ...validProfile });
    });

    it("creates a profile for a user who holds mentee and mentor roles together", async () => {
      upsertMentorProfile.mockResolvedValue({
        userId: "u-both",
        ...validProfile,
        user: { roles: ["mentee", "mentor"] },
      });

      const response = await request(app)
        .put("/api/mentors/me")
        .set("Authorization", `Bearer ${tokenFor("u-both", ["mentee", "mentor"])}`)
        .send(validProfile);

      expect(response.status).toBe(200);
      expect(upsertMentorProfile).toHaveBeenCalledWith("u-both", validProfile);
    });
  });
});
