process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createLinkedinRouter } = require("./linkedin");
const { createAuthMiddleware } = require("../../middleware/auth");
const { errorHandler } = require("../../middleware/errors");

const JWT_SECRET = process.env.JWT_SECRET;
const CONFIG = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:5001/api/auth/linkedin/callback",
  clientUrl: "http://localhost:3000",
};

function buildApp({
  fetchImpl,
  userRepository = { updateProfile: jest.fn() },
  config = CONFIG,
} = {}) {
  const app = express();
  const router = createLinkedinRouter({
    userRepository,
    authenticate: createAuthMiddleware(JWT_SECRET),
    jwtSecret: JWT_SECRET,
    config,
    fetchImpl,
    logger: { error() {} },
  });
  app.use("/api/auth/linkedin", router);
  app.use(errorHandler);
  return { app, userRepository };
}

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, JWT_SECRET);
}

function mockLinkedinFetch(info) {
  return jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "access-token" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => info });
}

describe("LinkedIn OAuth router", () => {
  describe("GET /start", () => {
    it("requires auth in profile mode", async () => {
      const { app } = buildApp();
      const response = await request(app).get("/api/auth/linkedin/start");
      expect(response.status).toBe(401);
    });

    it("returns a valid authorize URL bound to the user in profile mode", async () => {
      const { app } = buildApp();
      const response = await request(app)
        .get("/api/auth/linkedin/start")
        .set("Authorization", `Bearer ${tokenFor("u1")}`);

      expect(response.status).toBe(200);
      const url = new URL(response.body.url);
      expect(`${url.origin}${url.pathname}`).toBe(
        "https://www.linkedin.com/oauth/v2/authorization"
      );
      expect(url.searchParams.get("scope")).toBe("openid profile email");
      expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
      const claims = jwt.verify(url.searchParams.get("state"), JWT_SECRET);
      expect(claims).toMatchObject({
        mode: "profile",
        uid: "u1",
        purpose: "linkedin_oauth",
      });
    });

    it("does not require auth in register mode", async () => {
      const { app } = buildApp();
      const response = await request(app).get(
        "/api/auth/linkedin/start?mode=register"
      );
      expect(response.status).toBe(200);
      const claims = jwt.verify(
        new URL(response.body.url).searchParams.get("state"),
        JWT_SECRET
      );
      expect(claims).toMatchObject({ mode: "register", purpose: "linkedin_oauth" });
      expect(claims.uid).toBeUndefined();
    });

    it("returns 501 when LinkedIn is not configured", async () => {
      const { app } = buildApp({
        config: { clientId: "", clientSecret: "", redirectUri: "" },
      });
      const response = await request(app).get(
        "/api/auth/linkedin/start?mode=register"
      );
      expect(response.status).toBe(501);
      expect(response.body.error.code).toBe("LINKEDIN_NOT_CONFIGURED");
    });
  });

  describe("GET /callback", () => {
    it("writes photo_url and redirects on profile-mode success", async () => {
      const fetchImpl = mockLinkedinFetch({
        picture: "https://media.licdn.com/pic.jpg",
        name: "Ada Lovelace",
        email: "ada@example.com",
      });
      const updateProfile = jest.fn().mockResolvedValue({});
      const { app } = buildApp({ fetchImpl, userRepository: { updateProfile } });
      const state = jwt.sign(
        { mode: "profile", uid: "u1", purpose: "linkedin_oauth" },
        JWT_SECRET
      );

      const response = await request(app).get(
        `/api/auth/linkedin/callback?code=abc&state=${state}`
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        "http://localhost:3000/profile?linkedin=connected"
      );
      expect(updateProfile).toHaveBeenCalledWith("u1", {
        photo_url: "https://media.licdn.com/pic.jpg",
      });
      expect(fetchImpl).toHaveBeenNthCalledWith(
        1,
        "https://www.linkedin.com/oauth/v2/accessToken",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("stashes register-mode prefill retrievable once via /pending", async () => {
      const fetchImpl = mockLinkedinFetch({
        picture: "https://media.licdn.com/pic.jpg",
        name: "Ada Lovelace",
        email: "ada@example.com",
      });
      const { app } = buildApp({ fetchImpl });
      const state = jwt.sign(
        { mode: "register", purpose: "linkedin_oauth" },
        JWT_SECRET
      );

      const callback = await request(app).get(
        `/api/auth/linkedin/callback?code=abc&state=${state}`
      );
      expect(callback.status).toBe(302);
      const location = new URL(callback.headers.location);
      expect(location.pathname).toBe("/register");
      expect(location.searchParams.get("linkedin")).toBe("connected");
      const ref = location.searchParams.get("ref");
      expect(ref).toBeTruthy();

      const pending = await request(app).get(`/api/auth/linkedin/pending/${ref}`);
      expect(pending.status).toBe(200);
      expect(pending.body).toEqual({
        photo_url: "https://media.licdn.com/pic.jpg",
        full_name: "Ada Lovelace",
        email: "ada@example.com",
      });

      // Single-use: a second read is gone.
      const again = await request(app).get(`/api/auth/linkedin/pending/${ref}`);
      expect(again.status).toBe(404);
    });

    it("redirects to an error (not 500) on a bad state", async () => {
      const fetchImpl = jest.fn();
      const { app } = buildApp({ fetchImpl });
      const response = await request(app).get(
        "/api/auth/linkedin/callback?code=abc&state=bad"
      );
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        "http://localhost:3000/profile?linkedin=error"
      );
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
