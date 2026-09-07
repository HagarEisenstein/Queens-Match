process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");

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

describe("POST /api/users/avatar", () => {
  it("uploads the avatar and stores the returned URL", async () => {
    const updatePhotoUrl = jest.fn().mockResolvedValue({
      id: "u1",
      email: "queen@example.com",
      username: "queen",
      roles: ["mentee"],
      photo_url: "https://bucket.s3.us-east-1.amazonaws.com/avatars/u1-1.png",
    });
    const uploadUserAvatar = jest
      .fn()
      .mockResolvedValue("https://bucket.s3.us-east-1.amazonaws.com/avatars/u1-1.png");

    const app = createApp({
      jwtSecret: process.env.JWT_SECRET,
      notifications: stubNotifications,
      avatarStorage: { uploadUserAvatar },
      userRepository: {
        findPublicById: async () => ({
          id: "u1",
          roles: ["mentee"],
        }),
        updatePhotoUrl,
      },
    });

    const response = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .attach("avatar", Buffer.from("png-bytes"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(uploadUserAvatar).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        file: expect.objectContaining({
          mimetype: "image/png",
          originalname: "avatar.png",
        }),
      })
    );
    expect(updatePhotoUrl).toHaveBeenCalledWith(
      "u1",
      "https://bucket.s3.us-east-1.amazonaws.com/avatars/u1-1.png"
    );
    expect(response.body.photoUrl).toBe(
      "https://bucket.s3.us-east-1.amazonaws.com/avatars/u1-1.png"
    );
  });

  it("rejects unsupported file types", async () => {
    const app = createApp({
      jwtSecret: process.env.JWT_SECRET,
      notifications: stubNotifications,
      avatarStorage: { uploadUserAvatar: jest.fn() },
      userRepository: {
        findPublicById: async () => ({
          id: "u1",
          roles: ["mentee"],
        }),
        updatePhotoUrl: jest.fn(),
      },
    });

    const response = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .attach("avatar", Buffer.from("text"), {
        filename: "avatar.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "INVALID_AVATAR_FILE",
        message: "Avatar must be a JPEG, PNG, or WebP image.",
      },
    });
  });

  it("returns a clear configuration error when S3 env vars are missing", async () => {
    const previousEnv = {
      AWS_REGION: process.env.AWS_REGION,
      AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    };
    delete process.env.AWS_REGION;
    delete process.env.AWS_BUCKET_NAME;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const app = createApp({
      jwtSecret: process.env.JWT_SECRET,
      notifications: stubNotifications,
      avatarStorage: null,
      userRepository: {
        findPublicById: async () => ({
          id: "u1",
          roles: ["mentee"],
        }),
        updatePhotoUrl: jest.fn(),
      },
    });

    const response = await request(app)
      .post("/api/users/avatar")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .attach("avatar", Buffer.from("png-bytes"), {
        filename: "avatar.png",
        contentType: "image/png",
      });

    process.env.AWS_REGION = previousEnv.AWS_REGION;
    process.env.AWS_BUCKET_NAME = previousEnv.AWS_BUCKET_NAME;
    process.env.AWS_ACCESS_KEY_ID = previousEnv.AWS_ACCESS_KEY_ID;
    process.env.AWS_SECRET_ACCESS_KEY = previousEnv.AWS_SECRET_ACCESS_KEY;

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("AVATAR_STORAGE_NOT_CONFIGURED");
    expect(response.body.error.message).toContain("Missing environment variables");
  });
});
