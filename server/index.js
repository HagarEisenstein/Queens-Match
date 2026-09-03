require("dotenv").config();
const { createApp } = require("./app");
const logger = require("./commons/logger");

const PORT = process.env.PORT || 5000;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("Server started", {
      port: PORT,
      healthCheck: `http://localhost:${PORT}/api/health`,
    });
  });
}

module.exports = app;
