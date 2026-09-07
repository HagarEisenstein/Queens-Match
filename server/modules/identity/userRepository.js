const { randomBytes } = require("crypto");

const PUBLIC_COLUMNS = `
  id, email, username, phone, roles, full_name, photo_url, github_url, linkedin_url,
  job, workplace, years_experience, tech_stack, created_at, neon_auth_user_id
`;

function sanitizeUsernameBase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function buildUsernameCandidate({ email, name }) {
  const fromName = sanitizeUsernameBase(name);
  const fromEmail = sanitizeUsernameBase(String(email || "").split("@")[0]);
  const base = fromName || fromEmail || "user";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(user) {
    const result = await this.pool.query(
      `INSERT INTO users (
        id, email, password_hash, username, phone, roles, full_name, photo_url,
        github_url, linkedin_url, job, workplace, years_experience, tech_stack,
        neon_auth_user_id
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13::text[],
        $14
      ) RETURNING ${PUBLIC_COLUMNS}`,
      [
        user.email,
        user.password_hash ?? null,
        user.username,
        user.phone || null,
        user.roles,
        user.full_name || null,
        user.photo_url || null,
        user.github_url || null,
        user.linkedin_url || null,
        user.job || null,
        user.workplace || null,
        user.years_experience ?? null,
        user.tech_stack || [],
        user.neon_auth_user_id || null,
      ]
    );
    return result.rows[0];
  }

  async findAuthByEmail(email) {
    const result = await this.pool.query(
      `SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findByNeonAuthUserId(neonAuthUserId) {
    const result = await this.pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE neon_auth_user_id = $1`,
      [neonAuthUserId]
    );
    return result.rows[0] || null;
  }

  async linkNeonAuthUserId(userId, neonAuthUserId) {
    const result = await this.pool.query(
      `UPDATE users
       SET neon_auth_user_id = $2
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [userId, neonAuthUserId]
    );
    return result.rows[0] || null;
  }

  async findPublicById(id) {
    const result = await this.pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async updateProfile(id, profile) {
    const entries = Object.entries(profile);
    if (!entries.length) return this.findPublicById(id);

    const assignments = entries.map(
      ([field], index) =>
        `${field} = $${index + 2}${field === "tech_stack" ? "::text[]" : ""}`
    );
    const values = entries.map(([, value]) => value);
    const result = await this.pool.query(
      `UPDATE users
       SET ${assignments.join(", ")}
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async createFromNeonIdentity(identity, { roles }) {
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.create({
          email: identity.email,
          password_hash: null,
          username: buildUsernameCandidate(identity),
          roles,
          full_name: identity.name || null,
          photo_url: identity.image || null,
          neon_auth_user_id: identity.neonUserId,
          tech_stack: [],
        });
      } catch (error) {
        lastError = error;
        if (error.code !== "23505") throw error;
      }
    }
    throw lastError;
  }
}

module.exports = { PostgresUserRepository, buildUsernameCandidate };
