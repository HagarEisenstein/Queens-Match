const PUBLIC_COLUMNS = `
  id, email, username, phone, roles, full_name, photo_url, github_url, linkedin_url,
  job, workplace, years_experience, tech_stack, created_at
`;

class PostgresUserRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async create(user) {
    const result = await this.pool.query(
      `INSERT INTO users (
        id, email, password_hash, username, phone, roles, full_name, photo_url,
        github_url, linkedin_url, job, workplace, years_experience, tech_stack
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13::text[]
      ) RETURNING ${PUBLIC_COLUMNS}`,
      [
        user.email,
        user.password_hash,
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

  async findPublicByEmail(email) {
    const result = await this.pool.query(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE email = $1`,
      [email]
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

  async updateAuthAndRoles(id, { password_hash, roles }) {
    const result = await this.pool.query(
      `UPDATE users
       SET password_hash = $2,
           roles = $3::text[]
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, password_hash, roles]
    );
    return result.rows[0] || null;
  }

  async updateRoles(id, roles) {
    const result = await this.pool.query(
      `UPDATE users
       SET roles = $2::text[]
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, roles]
    );
    return result.rows[0] || null;
  }
}

module.exports = { PostgresUserRepository };
