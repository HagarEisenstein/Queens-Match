const logger = require("./logger");

function notFound(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

function errorHandler(err, req, res, next) {
  logger.error(err.message, { method: req.method, path: req.path });
  const status = err.statusCode || 500;
  res.status(status).json({
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: status === 500 ? "Internal server error" : err.message,
    },
  });
}

module.exports = { notFound, errorHandler };
