const request = require("supertest");
const bcrypt = require("bcrypt");
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
    app = createApp({ userRepository: repository, jwtSecret: JWT_SECRET });
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
});
