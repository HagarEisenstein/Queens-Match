const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { getPool, pingDatabase } = require("./db");
const { createAuthMiddleware } = require("./middleware/auth");
const { errorHandler, notFound } = require("./middleware/errors");
const { createIdentityRouters } = require("./modules/identity/routes");
const {
  PostgresUserRepository,
} = require("./modules/identity/userRepository");
const createMentorsRouter = require("./routes/mentors");
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
      notificationService: notifications.notificationService,
      meetingQueryPort,
      meetingLifecyclePort,
      feedbackRepository,
    });

  const { authRouter, usersRouter } = createIdentityRouters({
    userRepository,
    authenticate,
    jwtSecret,
    jwtExpiresIn: options.jwtExpiresIn || process.env.JWT_EXPIRES_IN || "1d",
  });

  const app = express();
  app.use(
    helmet({
      // CRA production assets are fine with default Helmet headers except CSP,
      // which blocks the bundled app when Express serves client/build.
      contentSecurityPolicy: false,
    })
  );
  app.use(cors());
  if (process.env.NODE_ENV !== "test") app.use(morgan("combined"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/mentors", createMentorsRouter({ authenticate }));
  app.use(
    "/api/notifications",
    createNotificationsRouter({
      authenticate,
      notificationRepository: notifications.notificationRepository,
      realtimeHub: notifications.realtimeHub,
    })
  );
  app.use("/api/engagement", engagement.router);

  mountClientApp(app);
  app.use(notFound);
  app.use(errorHandler);
  app.locals.notifications = notifications;
  app.locals.engagement = engagement;
  return app;
}

module.exports = { createApp };
