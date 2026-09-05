const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const email = "admin@queensmatch.local";
const password = "Admin123!";
const username = "demo-admin";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create the demo admin.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  try {
    const passwordHash = await bcrypt.hash(
      password,
      Number(process.env.BCRYPT_ROUNDS) || 12
    );
    await pool.query(
      `INSERT INTO users (id, email, password_hash, username, roles, full_name, tech_stack)
       VALUES (gen_random_uuid(), $1, $2, $3, ARRAY['admin']::text[], 'Demo Admin', ARRAY[]::text[])
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           username = EXCLUDED.username,
           roles = ARRAY['admin']::text[],
           full_name = EXCLUDED.full_name`,
      [email, passwordHash, username]
    );
    console.log(`Demo admin is ready: ${email}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
