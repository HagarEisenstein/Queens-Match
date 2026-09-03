const { Pool } = require("pg");

let pool;

function shouldUseSsl(connectionString) {
  if (process.env.PGSSLMODE === "disable") return false;
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;

  const url = connectionString || "";
  if (/[?&]sslmode=(require|verify-full|verify-ca)/i.test(url)) return true;
  if (/[?&]sslmode=disable/i.test(url)) return false;

  // Hosted Postgres typically requires TLS; local Docker/Postgres usually does not.
  return process.env.NODE_ENV === "production";
}

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is required. Copy server/.env.example to server/.env and set a Postgres URL."
      );
    }

    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString)
        ? { rejectUnauthorized: false }
        : false,
    });

    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error:", error.message);
    });
  }
  return pool;
}

async function pingDatabase() {
  const result = await getPool().query("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = { getPool, pingDatabase, closePool, shouldUseSsl };
