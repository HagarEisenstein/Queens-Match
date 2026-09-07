const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { createApp } = require("../app");

const JWT_SECRET = "identity-test-secret";

class MemoryUserRepository {
  constructor() {
    this.users = [];
  }

  publicUser(user) {
    const { password_hash, neon_auth_user_id, ...publicFields } = user;
    return { ...publicFields, roles: [...user.roles], tech_stack: [...user.tech_stack] };
  }

  async create(input) {
    if (
      this.users.some(
        (user) =>
          user.email === input.email ||
          user.username === input.username ||
          (input.neon_auth_user_id &&
            user.neon_auth_user_id === input.neon_auth_user_id)
      )
    ) {
      const error = new Error("duplicate");
      error.code = "23505";
      throw error;
    }
    const user = {
      id: randomUUID(),
      full_name: null,
      photo_url: null,
      github_url: null,
      linkedin_url: null,
      job: null,
      workplace: null,
      years_experience: null,
      tech_stack: [],
      neon_auth_user_id: null,
      created_at: new Date().toISOString(),
      ...input,
    };
    this.users.push(user);
    return this.publicUser(user);
  }

  async findAuthByEmail(email) {
    const user = this.users.find((candidate) => candidate.email === email);
    return user ? { ...user } : null;
  }

  async findByNeonAuthUserId(neonAuthUserId) {
    const user = this.users.find(
      (candidate) => candidate.neon_auth_user_id === neonAuthUserId
    );
    return user ? this.publicUser(user) : null;
  }

  async linkNeonAuthUserId(userId, neonAuthUserId) {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    user.neon_auth_user_id = neonAuthUserId;
    return this.publicUser(user);
  }

  async createFromNeonIdentity(identity, { roles }) {
    return this.create({
      email: identity.email,
      password_hash: null,
      username: `google-${identity.neonUserId.slice(0, 8)}`,
      roles,
      full_name: identity.name || null,
      photo_url: identity.image || null,
      neon_auth_user_id: identity.neonUserId,
      tech_stack: [],
    });
  }

  async findPublicById(id) {
    const user = this.users.find((candidate) => candidate.id === id);
    return user ? this.publicUser(user) : null;
  }

  async updateProfile(id, profile) {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    Object.assign(user, profile);
    return this.publicUser(user);
  }
}

describe("Epic 1 identity API", () => {
  let repository;
  let app;

  beforeAll(() => {
    process.env.BCRYPT_ROUNDS = "4";
  });

  beforeEach(() => {
    repository = new MemoryUserRepository();
    app = createApp({
      userRepository: repository,
      jwtSecret: JWT_SECRET,
      verifyNeonToken: async (token) => {
        if (token === "valid-neon-token") {
          return {
            neonUserId: "neon-user-123",
            email: "google.user@example.com",
            name: "Google User",
            image: "https://example.com/avatar.png",
            emailVerified: true,
          };
        }
        if (token === "link-existing-token") {
          return {
            neonUserId: "neon-user-link",
            email: "existing@example.com",
            name: "Existing User",
            image: null,
            emailVerified: true,
          };
        }
        const error = new Error("invalid");
        error.code = "NEON_TOKEN_INVALID";
        throw error;
      },
    });
  });

  test("rejects a weak password with the standard JSON error", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "weak@example.com",
      username: "weak-user",
      password: "password",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid fields.",
        details: {
          password: expect.arrayContaining([
            "Password must contain an uppercase letter.",
            "Password must contain a number.",
            "Password must contain a special character.",
          ]),
        },
      },
    });
  });

  test("registers strong credentials, profile fields, and a role set securely", async () => {
    const password = "Strong!Pass9";
    const roles = ["mentee", "mentor", "mentor"];
    const response = await request(app).post("/api/auth/register").send({
      email: "ALL.ROLES@example.com",
      username: "all-roles",
      password,
      roles,
      job: "Engineer",
      workplace: "QueenB",
      years_experience: 4,
      tech_stack: ["Node.js", "React", "React"],
      github_url: "https://github.com/all-roles",
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: "all.roles@example.com",
      username: "all-roles",
      roles: ["mentee", "mentor"],
      job: "Engineer",
      workplace: "QueenB",
      years_experience: 4,
      tech_stack: ["Node.js", "React"],
    });
    expect(response.body.user).not.toHaveProperty("password");
    expect(response.body.user).not.toHaveProperty("password_hash");
    expect(jwt.verify(response.body.token, JWT_SECRET)).toMatchObject({
      id: response.body.user.id,
      roles: ["mentee", "mentor"],
    });
    expect(repository.users[0].password_hash).not.toBe(password);
    await expect(
      bcrypt.compare(password, repository.users[0].password_hash)
    ).resolves.toBe(true);
  });

  test("logs in and returns a signed JWT containing id and every role", async () => {
    const storedUser = await repository.create({
      email: "mentor-admin@example.com",
      username: "mentor-admin",
      password_hash: await bcrypt.hash("Strong!Pass9", 4),
      roles: ["mentee", "mentor", "admin"],
      tech_stack: [],
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "mentor-admin@example.com",
      password: "Strong!Pass9",
    });
    const payload = jwt.verify(response.body.token, JWT_SECRET);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: storedUser.id,
      roles: ["mentee", "mentor", "admin"],
    });
    expect(response.body.user).not.toHaveProperty("password_hash");
  });

  test("rejects incorrect login credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "login@example.com",
      username: "login-user",
      password: "Strong!Pass9",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "Wrong!Pass9",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("reads and updates only the authenticated user's profile", async () => {
    const registration = await request(app).post("/api/auth/register").send({
      email: "profile@example.com",
      username: "profile-user",
      password: "Strong!Pass9",
      tech_stack: ["JavaScript"],
    });
    const login = await request(app).post("/api/auth/login").send({
      email: "profile@example.com",
      password: "Strong!Pass9",
    });
    const authorization = `Bearer ${login.body.token}`;

    const update = await request(app)
      .put("/api/users/profile")
      .set("Authorization", authorization)
      .send({
        job: "Tech Lead",
        years_experience: 7,
        tech_stack: ["JavaScript", "PostgreSQL"],
      });
    const read = await request(app)
      .get("/api/users/profile")
      .set("Authorization", authorization);

    expect(update.status).toBe(200);
    expect(read.status).toBe(200);
    expect(read.body.user).toMatchObject({
      id: registration.body.user.id,
      job: "Tech Lead",
      years_experience: 7,
      tech_stack: ["JavaScript", "PostgreSQL"],
    });
    expect(read.body.user).not.toHaveProperty("password_hash");
  });

  test("requires authentication for profile routes", async () => {
    const response = await request(app).get("/api/users/profile");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  test("bridges a verified Neon Auth identity into a QueenB JWT user", async () => {
    const response = await request(app).post("/api/auth/neon").send({
      neonToken: "valid-neon-token",
      roles: ["mentee", "mentor"],
    });

    expect(response.status).toBe(201);
    expect(response.body.created).toBe(true);
    expect(response.body.user).toMatchObject({
      email: "google.user@example.com",
      roles: ["mentee", "mentor"],
      full_name: "Google User",
      photo_url: "https://example.com/avatar.png",
    });
    expect(response.body.user).not.toHaveProperty("password_hash");
    expect(response.body.user).not.toHaveProperty("neon_auth_user_id");
    expect(jwt.verify(response.body.token, JWT_SECRET)).toMatchObject({
      id: response.body.user.id,
      roles: ["mentee", "mentor"],
    });
    expect(repository.users[0].password_hash).toBeNull();
    expect(repository.users[0].neon_auth_user_id).toBe("neon-user-123");
  });

  test("links Neon Auth to an existing email/password account", async () => {
    await repository.create({
      email: "existing@example.com",
      username: "existing-user",
      password_hash: await bcrypt.hash("Strong!Pass9", 4),
      roles: ["mentee"],
      tech_stack: [],
    });

    const response = await request(app).post("/api/auth/neon").send({
      neonToken: "link-existing-token",
    });

    expect(response.status).toBe(200);
    expect(response.body.created).toBe(false);
    expect(response.body.user.email).toBe("existing@example.com");
    expect(repository.users[0].neon_auth_user_id).toBe("neon-user-link");
    expect(repository.users[0].password_hash).toBeTruthy();
  });

  test("rejects password login for Google-only accounts", async () => {
    await repository.create({
      email: "oauth-only@example.com",
      username: "oauth-only",
      password_hash: null,
      roles: ["mentee"],
      tech_stack: [],
      neon_auth_user_id: "neon-oauth-only",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "oauth-only@example.com",
      password: "Whatever!1",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("OAUTH_ONLY_ACCOUNT");
  });

  test("rejects an invalid Neon Auth token", async () => {
    const response = await request(app).post("/api/auth/neon").send({
      neonToken: "bad-token",
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("NEON_TOKEN_INVALID");
  });

  test("maps distinct Neon verification failures to specific API codes", async () => {
    const cases = [
      ["expired", "NEON_TOKEN_EXPIRED", "Neon Auth token has expired."],
      [
        "bad-issuer",
        "NEON_TOKEN_INVALID_ISSUER",
        "Neon Auth token issuer is invalid.",
      ],
      [
        "bad-audience",
        "NEON_TOKEN_INVALID_AUDIENCE",
        "Neon Auth token audience is invalid.",
      ],
      [
        "bad-signature",
        "NEON_TOKEN_INVALID_SIGNATURE",
        "Neon Auth token signature is invalid.",
      ],
      [
        "missing-claims",
        "NEON_TOKEN_MISSING_CLAIMS",
        "Neon Auth token is missing required identity claims.",
      ],
    ];

    for (const [token, code, message] of cases) {
      const scopedApp = createApp({
        userRepository: repository,
        jwtSecret: JWT_SECRET,
        verifyNeonToken: async () => {
          const error = new Error(message);
          error.code = code;
          throw error;
        },
      });

      const response = await request(scopedApp).post("/api/auth/neon").send({
        neonToken: token,
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({ code, message });
    }
  });
});
