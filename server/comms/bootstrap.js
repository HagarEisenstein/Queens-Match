const cron = require("node-cron");
const eventBus = require("../commons/eventBus");
const logger = require("../commons/logger");
const prisma = require("../commons/db");
const { createNotificationCenterService } = require("./notificationCenterService");
const { createRealtimeHub } = require("./realtimeHub");
const { createPrismaNotificationRepository } = require("./repositories/prismaNotificationRepository");
const { createPrismaDeliveryRepository } = require("./repositories/prismaDeliveryRepository");
const { createPrismaRecipientRepository } = require("./repositories/prismaRecipientRepository");
const { createEmailFallbackJob } = require("./jobs/emailFallbackJob");
const { createBrevoProvider } = require("./providers/brevoProvider");
const { createConsoleProvider } = require("./providers/consoleProvider");
const { createWhatsAppProvider } = require("./providers/whatsappProvider");
const { createWhatsAppOrEmailProvider } = require("./providers/whatsappOrEmailProvider");
const { createTwilioEmailProvider } = require("./providers/twilioEmailProvider");
const { registerNotificationEventHandlers } = require("./registerEventHandlers");
const { createAdminAlertService } = require("../services/adminAlertService");
const { createMeetingReminderJob } = require("./jobs/meetingReminderJob");
const { createPostMeetingCheckJob } = require("./jobs/postMeetingCheckJob");
const { createFeedbackReminderJob } = require("./jobs/feedbackReminderJob");
const { startNotificationJobs } = require("./jobs/startJobs");

function parsePositiveInt(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Resolve the configured notification provider. `NOTIFICATION_PROVIDER=email`
 * must always land on the Gmail/SMTP provider — never on the Twilio email
 * fallback, which only exists for the WhatsApp path.
 */
function createConfiguredProvider(env, logger) {
  if (env.NOTIFICATION_PROVIDER === "email") {
    return createBrevoProvider(env, { logger });
  }
  if (env.NOTIFICATION_PROVIDER === "whatsapp") {
    return createWhatsAppOrEmailProvider(env, {
      whatsappProvider: createWhatsAppProvider(env, { logger }),
      emailProvider: createTwilioEmailProvider(env),
    });
  }
  return createConsoleProvider({ logger });
}

function bootstrapNotifications({
  env = process.env,
  scheduler = cron,
  meetingRepository,
  feedbackRepository,
  adminRecipientRepository = null,
  adminAlertService = null,
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
  const recipientRepository = createPrismaRecipientRepository(prisma);
  const realtimeHub = createRealtimeHub();
  const provider = createConfiguredProvider(env, logger);
  const notificationService = createNotificationCenterService({
    notificationRepository,
    deliveryRepository,
    recipientRepository,
    emailProvider: provider,
    realtimeHub,
    emailDelayMilliseconds,
  });
  const emailFallbackJob = createEmailFallbackJob({ deliveryRepository, emailProvider: provider });
  const adminRecipients = adminRecipientRepository || {
    findAdmins: () => prisma.user.findMany({
      where: { roles: { has: "admin" } },
      select: { id: true },
    }),
  };
  const alertService = adminAlertService || createAdminAlertService({ prisma });
  const unregisterHandlers = registerNotificationEventHandlers({
    eventBus,
    notificationService,
    logger,
    adminRecipientRepository: adminRecipients,
    adminAlertService: alertService,
  });
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
        cronExpression: env.NOTIFICATION_JOBS_CRON || "*/5 * * * *",
      })
      : null;

  return {
    notificationRepository,
    realtimeHub,
    notificationService,
    provider,
    emailFallbackJob,
    unregisterHandlers,
    scheduledTask,
    meetingTask,
    meetingReminderJob,
    postMeetingCheckJob,
    feedbackReminderJob,
    config: {
      emailDelayMilliseconds,
      reminderLeadTimeMilliseconds,
      scanWindowMilliseconds,
      feedbackIntervalMilliseconds,
    },
  };
}

module.exports = { bootstrapNotifications };
