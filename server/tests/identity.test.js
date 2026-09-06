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
    const { password_hash, ...publicFields } = user;
    return { ...publicFields, roles: [...user.roles], tech_stack: [...user.tech_stack] };
  }

  async create(input) {
    if (
      this.users.some(
        (user) => user.email === input.email || user.username === input.username
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

  async findPublicByEmail(email) {
    const user = this.users.find((candidate) => candidate.email === email);
    return user ? this.publicUser(user) : null;
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

  async updateAuthAndRoles(id, { password_hash, roles }) {
    const user = this.users.find((candidate) => candidate.id === id);
    if (!user) return null;
    user.password_hash = password_hash;
    user.roles = [...roles];
    return this.publicUser(user);
  }
}

class MemoryAdminInviteRepository {
  constructor() {
    this.invites = [];
  }

  async create({ email, invited_by, expires_at }) {
    const invite = {
      id: randomUUID(),
      email,
      invited_by,
      expires_at,
      created_at: new Date().toISOString(),
      token: randomUUID(),
      accepted_at: null,
      accepted_by: null,
    };
    this.invites.push(invite);
    return invite;
  }

  async findActiveByToken(token) {
    const invite = this.invites.find((candidate) => candidate.token === token);
    if (!invite) return null;
    if (invite.accepted_at) return null;
    if (new Date(invite.expires_at) <= new Date()) return null;
    return { ...invite };
  }

  async markAccepted(id, accepted_by) {
    const invite = this.invites.find((candidate) => candidate.id === id);
    if (!invite) return null;
    invite.accepted_at = new Date().toISOString();
    invite.accepted_by = accepted_by;
    return { ...invite };
  }
}

describe("Epic 1 identity API", () => {
  let repository;
  let adminInviteRepository;
  let app;

  beforeAll(() => {
    process.env.BCRYPT_ROUNDS = "4";
  });

  beforeEach(() => {
    repository = new MemoryUserRepository();
    adminInviteRepository = new MemoryAdminInviteRepository();
    app = createApp({
      userRepository: repository,
      adminInviteRepository,
      jwtSecret: JWT_SECRET,
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

  test("previews an active admin invite for a brand new user", async () => {
    const invite = await adminInviteRepository.create({
      email: "new-admin@example.com",
      invited_by: randomUUID(),
      expires_at: new Date(Date.now() + 60_000),
    });

    const response = await request(app)
      .get("/api/auth/accept-invite")
      .query({ token: invite.token });

    expect(response.status).toBe(200);
    expect(response.body.invite).toMatchObject({
      email: "new-admin@example.com",
      hasAccount: false,
      username: "",
    });
  });

  test("accepts an admin invite for a brand new user and grants the admin role", async () => {
    const invite = await adminInviteRepository.create({
      email: "brand-new-admin@example.com",
      invited_by: randomUUID(),
      expires_at: new Date(Date.now() + 60_000),
    });

    const response = await request(app).post("/api/auth/accept-invite").send({
      token: invite.token,
      username: "brand-new-admin",
      password: "Strong!Pass9",
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "brand-new-admin@example.com",
      username: "brand-new-admin",
      roles: ["admin"],
    });
    expect(jwt.verify(response.body.token, JWT_SECRET)).toMatchObject({
      id: response.body.user.id,
      roles: ["admin"],
    });
  });

  test("accepts an admin invite for an existing user by adding the admin role", async () => {
    const existingUser = await repository.create({
      email: "mentor@example.com",
      username: "mentor-user",
      password_hash: await bcrypt.hash("Old!Pass9", 4),
      roles: ["mentor"],
      tech_stack: [],
    });
    const invite = await adminInviteRepository.create({
      email: existingUser.email,
      invited_by: randomUUID(),
      expires_at: new Date(Date.now() + 60_000),
    });

    const response = await request(app).post("/api/auth/accept-invite").send({
      token: invite.token,
      password: "Strong!Pass9",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.roles).toEqual(["mentor", "admin"]);
    await expect(
      bcrypt.compare(
        "Strong!Pass9",
        repository.users.find((user) => user.id === existingUser.id).password_hash
      )
    ).resolves.toBe(true);
  });
});
