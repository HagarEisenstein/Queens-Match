class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || error.statusCode || 500;
  const body = {
    error: {
      code: error.code || "INTERNAL_SERVER_ERROR",
      message:
        status === 500 ? "Internal server error" : error.message,
    },
  };

  if (error.details) {
    body.error.details = error.details;
  }

  if (status === 500 && process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  return res.status(status).json(body);
}

function notFound(req, res) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
}

module.exports = { AppError, errorHandler, notFound };
