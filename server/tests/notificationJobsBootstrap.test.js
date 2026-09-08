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
    findPendingEmailDeliveryForNotification: async () => null,
  }),
}));
jest.mock("../comms/repositories/prismaRecipientRepository", () => ({
  createPrismaRecipientRepository: () => ({
    findById: async () => null,
  }),
}));

jest.mock("../comms/providers/twilioEmailProvider", () => ({
  createTwilioEmailProvider: jest.fn(() => {
    throw new Error("Twilio email must never back NOTIFICATION_PROVIDER=email");
  }),
}));

const nodemailer = require("nodemailer");
const { bootstrapNotifications } = require("../comms/bootstrap");
const { createTwilioEmailProvider } = require("../comms/providers/twilioEmailProvider");

describe("production email provider selection", () => {
  const createTransport = nodemailer.createTransport;
  let transports;

  beforeEach(() => {
    transports = [];
    nodemailer.createTransport = (config) => {
      transports.push(config);
      return { sendMail: async () => ({ messageId: "test" }) };
    };
  });

  afterEach(() => {
    nodemailer.createTransport = createTransport;
    jest.clearAllMocks();
  });

  function bootstrapWithGmail() {
    return bootstrapNotifications({
      env: {
        NODE_ENV: "test",
        NOTIFICATION_PROVIDER: "email",
        SMTP_USER: "queenb@gmail.com",
        SMTP_PASSWORD: "app-password",
        EMAIL_FROM: "queenb@gmail.com",
        CLIENT_URL: "https://queenb-task-management-application.onrender.com",
        NOTIFICATION_EMAIL_DELAY_MS: "0",
      },
      adminRecipientRepository: { findAdmins: async () => [] },
      adminAlertService: { createAlert: async () => ({}) },
    });
  }

  it("uses the Gmail SMTP provider and never the Twilio email provider", () => {
    const result = bootstrapWithGmail();

    expect(result.provider.channel).toBe("email");
    expect(createTwilioEmailProvider).not.toHaveBeenCalled();
    result.unregisterHandlers();
  });

  it("configures Gmail on smtp.gmail.com:465 with TLS over IPv4", () => {
    const result = bootstrapWithGmail();

    expect(transports).toHaveLength(1);
    expect(transports[0]).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
      auth: { user: "queenb@gmail.com", pass: "app-password" },
    });
    expect(result.provider.smtp).toEqual({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      family: 4,
    });
    result.unregisterHandlers();
  });

  it("mails eligible notifications immediately when the delay is zero", () => {
    const result = bootstrapWithGmail();

    expect(result.config.emailDelayMilliseconds).toBe(0);
    result.unregisterHandlers();
  });
});

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

  it("defaults notification jobs cron to every five minutes", () => {
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

    expect(scheduled.some((item) => item.expression === "*/5 * * * *")).toBe(true);
    result.unregisterHandlers();
    if (result.scheduledTask?.stop) result.scheduledTask.stop();
    if (result.meetingTask?.stop) result.meetingTask.stop();
  });
});
