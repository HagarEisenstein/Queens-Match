const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { rateLimit } = require("express-rate-limit");
const { getPool, pingDatabase } = require("./db");
const { createAuthMiddleware, requireCurrentRole } = require("./middleware/auth");
const { AppError, errorHandler, notFound } = require("./middleware/errors");
const { createIdentityRouters } = require("./modules/identity/routes");
const {
  PostgresUserRepository,
} = require("./modules/identity/userRepository");
const createMentorsRouter = require("./routes/mentors");
const createMeetingsRouter = require("./routes/meetings");
const createAdminRouter = require("./routes/admin");
const { bootstrapNotifications } = require("./comms/bootstrap");
const { createNotificationsRouter } = require("./comms/routes");
const {
  bootstrapEngagement,
  createEmptyMeetingQueryPort,
  createNoopMeetingLifecyclePort,
  createPrismaFeedbackRepository,
} = require("./engagement");
const prisma = require("./commons/db");

function mountClientApp(app) {
  const clientBuildPath = path.join(__dirname, "..", "client", "build");
  if (!fs.existsSync(clientBuildPath)) {
    return;
  }

  app.use(express.static(clientBuildPath));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

function createApp(options = {}) {
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      "JWT_SECRET is required. Copy server/.env.example to server/.env and set a secret."
    );
  }

  const lazyPool = {
    query(...args) {
      return getPool().query(...args);
    },
  };
  const userRepository =
    options.userRepository || new PostgresUserRepository(lazyPool);
  const authenticate = createAuthMiddleware(jwtSecret);
  const authorizeAdmin = requireCurrentRole(userRepository, "admin");

  const meetingQueryPort =
    options.meetingQueryPort || createEmptyMeetingQueryPort();
  const meetingLifecyclePort =
    options.meetingLifecyclePort || createNoopMeetingLifecyclePort();
  const feedbackRepository =
    options.feedbackRepository || createPrismaFeedbackRepository(prisma);

  const notifications =
    options.notifications ||
    bootstrapNotifications({
      meetingRepository: options.meetingRepository || meetingQueryPort,
      feedbackRepository,
    });

  const engagement =
    options.engagement ||
    bootstrapEngagement({
      authenticate,
      authorizeAdmin,
      notificationService: notifications.notificationService,
      meetingQueryPort,
      meetingLifecyclePort,
      feedbackRepository,
    });

  const { authRouter, usersRouter } = createIdentityRouters({
    userRepository,
    authenticate,
    jwtSecret,
    jwtExpiresIn: options.jwtExpiresIn || process.env.JWT_EXPIRES_IN || "15m",
  });

  const app = express();
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  // When serving client/build from this server, the browser Origin is :PORT
  // (not CRA's :3000). Allow both in local/dev so either workflow works.
  const port = String(process.env.PORT || 5001);
  const localDevOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          `http://localhost:${port}`,
          `http://127.0.0.1:${port}`,
        ];
  const configuredOrigins = [
    ...(process.env.CORS_ORIGINS || "").split(","),
    process.env.RENDER_EXTERNAL_URL,
    ...localDevOrigins,
  ].map((origin) => origin?.trim()).filter(Boolean);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", ...configuredOrigins],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, "CORS_FORBIDDEN", "Origin is not allowed."));
    },
  }));
  if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
  app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || "32kb" }));
  app.use(express.urlencoded({
    extended: true,
    limit: process.env.REQUEST_BODY_LIMIT || "32kb",
  }));

  app.get("/api/health", async (req, res) => {
    let database = "unknown";
    try {
      if (process.env.DATABASE_URL) {
        database = (await pingDatabase()) ? "up" : "down";
      } else {
        database = "unconfigured";
      }
    } catch (error) {
      database = "down";
    }

    const healthy = database !== "down";
    res.status(healthy ? 200 : 503).json({
      message: "QueenB Server is running!",
      timestamp: new Date().toISOString(),
      status: healthy ? "healthy" : "degraded",
      database,
    });
  });

  const authLimiter = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    handler(req, res) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many authentication attempts. Please try again later.",
        },
      });
    },
  });
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/mentors", createMentorsRouter({ authenticate }));
  app.use("/api/meetings", createMeetingsRouter({ authenticate }));
  app.use(
    "/api/notifications",
    createNotificationsRouter({
      authenticate,
      notificationRepository: notifications.notificationRepository,
      realtimeHub: notifications.realtimeHub,
    })
  );
  app.use("/api/engagement", engagement.router);
  app.use("/api/admin", createAdminRouter({ authenticate, authorizeAdmin }));

  mountClientApp(app);
  app.use(notFound);
  app.use(errorHandler);
  app.locals.notifications = notifications;
  app.locals.engagement = engagement;
  return app;
}

module.exports = { createApp };
