const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { getPool } = require("./db");
const { createAuthMiddleware } = require("./middleware/auth");
const { errorHandler, notFound } = require("./middleware/errors");
const { createIdentityRouters } = require("./modules/identity/routes");
const {
  PostgresUserRepository,
} = require("./modules/identity/userRepository");
const mentorsRouter = require("./routes/mentors");

function createApp(options = {}) {
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required.");
  }

  const lazyPool = {
    query(...args) {
      return getPool().query(...args);
    },
  };
  const userRepository =
    options.userRepository || new PostgresUserRepository(lazyPool);
  const authenticate = createAuthMiddleware(jwtSecret);
  const { authRouter, usersRouter } = createIdentityRouters({
    userRepository,
    authenticate,
    jwtSecret,
    jwtExpiresIn: options.jwtExpiresIn || process.env.JWT_EXPIRES_IN || "1d",
  });

  const app = express();
  app.use(helmet());
  app.use(cors());
  if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({
      message: "QueenB Server is running!",
      timestamp: new Date().toISOString(),
      status: "healthy",
    });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/mentors", mentorsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
