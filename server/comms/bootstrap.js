const cron = require("node-cron");
const eventBus = require("../commons/eventBus");
const logger = require("../commons/logger");
const prisma = require("../commons/db");
const { createNotificationCenterService } = require("./notificationCenterService");
const { createRealtimeHub } = require("./realtimeHub");
const { createPrismaNotificationRepository } = require("./repositories/prismaNotificationRepository");
const { createPrismaDeliveryRepository } = require("./repositories/prismaDeliveryRepository");
const { createEmailFallbackJob } = require("./jobs/emailFallbackJob");
const { createBrevoProvider } = require("./providers/brevoProvider");
const { createConsoleProvider } = require("./providers/consoleProvider");
const { createWhatsAppProvider } = require("./providers/whatsappProvider");
const { registerNotificationEventHandlers } = require("./registerEventHandlers");
const { createMeetingReminderJob } = require("./jobs/meetingReminderJob");
const { createPostMeetingCheckJob } = require("./jobs/postMeetingCheckJob");
const { createFeedbackReminderJob } = require("./jobs/feedbackReminderJob");
const { startNotificationJobs } = require("./jobs/startJobs");
const { createAdminAlertService } = require("../services/adminAlertService");

function parsePositiveInt(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function bootstrapNotifications({
  env = process.env,
  scheduler = cron,
  meetingRepository,
  feedbackRepository,
} = {}) {
  const emailDelayMilliseconds = parsePositiveInt(
    env.NOTIFICATION_EMAIL_DELAY_MS,
    60 * 60 * 1000
  );
  const reminderLeadTimeMilliseconds = parsePositiveInt(
    env.NOTIFICATION_REMINDER_LEAD_MS,
    2 * 24 * 60 * 60 * 1000
  );
  const scanWindowMilliseconds = parsePositiveInt(
    env.NOTIFICATION_SCAN_WINDOW_MS,
    60 * 60 * 1000
  );
  const feedbackIntervalMilliseconds = parsePositiveInt(
    env.NOTIFICATION_FEEDBACK_INTERVAL_MS,
    2 * 24 * 60 * 60 * 1000
  );

  const notificationRepository = createPrismaNotificationRepository(prisma);
  const deliveryRepository = createPrismaDeliveryRepository(prisma);
  const realtimeHub = createRealtimeHub();
  const notificationService = createNotificationCenterService({
    notificationRepository,
    deliveryRepository,
    realtimeHub,
    emailDelayMilliseconds,
  });
  const provider = env.NOTIFICATION_PROVIDER === "email"
    ? createBrevoProvider(env)
    : env.NOTIFICATION_PROVIDER === "whatsapp"
      ? createWhatsAppProvider(env, { logger })
      : createConsoleProvider({ logger });
  const emailFallbackJob = createEmailFallbackJob({ deliveryRepository, emailProvider: provider });
  const unregisterHandlers = registerNotificationEventHandlers({ eventBus, notificationService, logger });
  const scheduledTask = env.NODE_ENV === "test" ? null : scheduler.schedule("* * * * *", () =>
    emailFallbackJob.run().catch((error) => logger.error("Email fallback job failed", { error: error.message }))
  );

  const meetingReminderJob = meetingRepository
    ? createMeetingReminderJob({
      meetingRepository,
      notificationService,
      reminderLeadTimeMilliseconds,
      scanWindowMilliseconds,
    })
    : null;
  const postMeetingCheckJob = meetingRepository
    ? createPostMeetingCheckJob({ meetingRepository, notificationService })
    : null;
  const feedbackReminderJob = feedbackRepository
    ? createFeedbackReminderJob({
      feedbackRepository,
      notificationService,
      reminderIntervalMilliseconds: feedbackIntervalMilliseconds,
    })
    : null;
  const adminAlertService = createAdminAlertService({ prisma, notificationService });
  const adminAlertJob = { run: (at) => adminAlertService.scan({ at }) };

  const meetingTask =
    env.NODE_ENV !== "test" &&
    meetingReminderJob &&
    postMeetingCheckJob &&
    feedbackReminderJob
      ? startNotificationJobs({
        scheduler,
        meetingReminderJob,
        postMeetingCheckJob,
        feedbackReminderJob,
        adminAlertJob,
        cronExpression: env.NOTIFICATION_JOBS_CRON || "0 * * * *",
      })
      : null;

  return {
    notificationRepository,
    realtimeHub,
    notificationService,
    emailFallbackJob,
    unregisterHandlers,
    scheduledTask,
    meetingTask,
    meetingReminderJob,
    postMeetingCheckJob,
    feedbackReminderJob,
    adminAlertService,
    config: {
      emailDelayMilliseconds,
      reminderLeadTimeMilliseconds,
      scanWindowMilliseconds,
      feedbackIntervalMilliseconds,
    },
  };
}

module.exports = { bootstrapNotifications };
