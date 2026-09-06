process.env.NODE_ENV = "test";

jest.mock("../commons/db", () => ({}));
jest.mock("../comms/repositories/prismaNotificationRepository", () => ({
  createPrismaNotificationRepository: () => ({
    findByDeduplicationKey: async () => null,
    create: async (item) => item,
  }),
}));
jest.mock("../comms/repositories/prismaDeliveryRepository", () => ({
  createPrismaDeliveryRepository: () => ({
    create: async (item) => item,
  }),
}));

const { bootstrapNotifications } = require("../comms/bootstrap");

describe("notification jobs bootstrap", () => {
  it("parses NOTIFICATION_*_MS env overrides", () => {
    const result = bootstrapNotifications({
      env: {
        NODE_ENV: "test",
        NOTIFICATION_PROVIDER: "console",
        NOTIFICATION_EMAIL_DELAY_MS: "120000",
        NOTIFICATION_REMINDER_LEAD_MS: "3600000",
        NOTIFICATION_SCAN_WINDOW_MS: "1800000",
        NOTIFICATION_FEEDBACK_INTERVAL_MS: "900000",
      },
      meetingRepository: {
        findScheduledMeetingsBetween: async () => [],
        findMeetingsAwaitingOutcome: async () => [],
      },
      feedbackRepository: {
        findOutstandingFeedbackRequests: async () => [],
      },
    });

    expect(result.config).toEqual({
      emailDelayMilliseconds: 120000,
      reminderLeadTimeMilliseconds: 3600000,
      scanWindowMilliseconds: 1800000,
      feedbackIntervalMilliseconds: 900000,
      notificationWorkerConcurrency: 5,
      notificationWorkerMaxAttempts: 5,
      notificationWorkerRateLimitMs: 0,
    });
    expect(result.meetingReminderJob).toBeTruthy();
    expect(result.postMeetingCheckJob).toBeTruthy();
    expect(result.feedbackReminderJob).toBeTruthy();
    expect(result.meetingTask).toBeNull();
  });

  it("does not start meeting jobs when repositories are missing", () => {
    const result = bootstrapNotifications({
      env: { NODE_ENV: "test", NOTIFICATION_PROVIDER: "console" },
    });

    expect(result.meetingReminderJob).toBeNull();
    expect(result.postMeetingCheckJob).toBeNull();
    expect(result.feedbackReminderJob).toBeNull();
    expect(result.meetingTask).toBeNull();
  });

  it("starts jobs outside test when repositories are injected", () => {
    const scheduled = [];
    const scheduler = {
      schedule(expression, callback) {
        scheduled.push({ expression, callback });
        return { stop() {} };
      },
    };

    const result = bootstrapNotifications({
      env: {
        NODE_ENV: "development",
        NOTIFICATION_PROVIDER: "console",
        NOTIFICATION_JOBS_CRON: "*/10 * * * *",
      },
      scheduler,
      meetingRepository: {
        findScheduledMeetingsBetween: async () => [],
        findMeetingsAwaitingOutcome: async () => [],
      },
      feedbackRepository: {
        findOutstandingFeedbackRequests: async () => [],
      },
    });

    expect(result.meetingTask).toBeTruthy();
    expect(scheduled.some((item) => item.expression === "*/10 * * * *")).toBe(true);

    result.unregisterHandlers();
    if (result.scheduledTask?.stop) result.scheduledTask.stop();
    if (result.meetingTask?.stop) result.meetingTask.stop();
  });
});
