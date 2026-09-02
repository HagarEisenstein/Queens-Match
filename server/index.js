const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();
const { notFound, errorHandler } = require("./commons/error.middleware");
const logger = require("./commons/logger");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    message: "Queens Match server is running",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("Server started", { port: PORT, healthCheck: `http://localhost:${PORT}/api/health` });
  });
}

module.exports = app;
