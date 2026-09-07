const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createApp } = require("./app");
const logger = require("./commons/logger");
const { getPool } = require("./db");

const PORT = process.env.PORT || 5000;
const app = createApp();

if (require.main === module) {
  (async () => {
    // Keep startup safe for Render services that were created manually and do
    // not run the Blueprint pre-deploy command.
    await getPool().query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT');
    app.listen(PORT, () => {
      logger.info("Server started", {
        port: PORT,
        healthCheck: `http://localhost:${PORT}/api/health`,
      });
    });
  })().catch((error) => {
    logger.error("Database initialization failed", { error: error.message });
    process.exitCode = 1;
  });
}

module.exports = app;
