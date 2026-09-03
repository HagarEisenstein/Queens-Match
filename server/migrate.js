require("dotenv").config();
const fs = require("fs/promises");
const path = require("path");
const { getPool } = require("./db");

async function migrate() {
  const migrationsDirectory = path.join(__dirname, "migrations");
  const files = (await fs.readdir(migrationsDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const pool = getPool();

  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
      await pool.query(sql);
      console.log(`Applied ${file}`);
    }
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
