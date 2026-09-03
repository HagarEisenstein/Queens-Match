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
const { registerNotificationEventHandlers } = require("./registerEventHandlers");
const { createMeetingReminderJob } = require("./jobs/meetingReminderJob");
const { createPostMeetingCheckJob } = require("./jobs/postMeetingCheckJob");
const { createFeedbackReminderJob } = require("./jobs/feedbackReminderJob");
const { startNotificationJobs } = require("./jobs/startJobs");

function bootstrapNotifications({ env = process.env, scheduler = cron, meetingRepository, feedbackRepository } = {}) {
  const notificationRepository = createPrismaNotificationRepository(prisma);
  const deliveryRepository = createPrismaDeliveryRepository(prisma);
  const realtimeHub = createRealtimeHub();
  const notificationService = createNotificationCenterService({ notificationRepository, deliveryRepository, realtimeHub });
  const emailProvider = env.NOTIFICATION_PROVIDER === "email"
    ? createBrevoProvider(env)
    : createConsoleProvider({ logger });
  const emailFallbackJob = createEmailFallbackJob({ deliveryRepository, emailProvider });
  const unregisterHandlers = registerNotificationEventHandlers({ eventBus, notificationService, logger });
  const scheduledTask = env.NODE_ENV === "test" ? null : scheduler.schedule("* * * * *", () =>
    emailFallbackJob.run().catch((error) => logger.error("Email fallback job failed", { error: error.message }))
  );
  const meetingTask = env.NODE_ENV !== "test" && meetingRepository && feedbackRepository
    ? startNotificationJobs({
      scheduler,
      meetingReminderJob: createMeetingReminderJob({ meetingRepository, notificationService }),
      postMeetingCheckJob: createPostMeetingCheckJob({ meetingRepository, notificationService }),
      feedbackReminderJob: createFeedbackReminderJob({ feedbackRepository, notificationService }),
      cronExpression: env.NOTIFICATION_JOBS_CRON || "0 * * * *",
    })
    : null;

  return { notificationRepository, realtimeHub, notificationService, emailFallbackJob, unregisterHandlers, scheduledTask, meetingTask };
}

module.exports = { bootstrapNotifications };
