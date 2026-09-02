const test = require("node:test");
const assert = require("node:assert/strict");
const { createMeetingReminderJob } = require("../jobs/meetingReminderJob");
const { createPostMeetingCheckJob } = require("../jobs/postMeetingCheckJob");
const { createFeedbackReminderJob } = require("../jobs/feedbackReminderJob");
const { startNotificationJobs } = require("../jobs/startJobs");
const { NOTIFICATION_TYPES } = require("../notificationTypes");

function createNotificationCollector() {
  const notifications = [];
  return {
    notifications,
    notificationService: {
      async send(notification) {
        notifications.push(notification);
      },
    },
  };
}

test("meeting reminder job reminds both parties and asks both to confirm arrival", async () => {
  const { notifications, notificationService } = createNotificationCollector();
  const meetingRepository = {
    async findScheduledMeetingsBetween() {
      return [{
        id: "meeting-1",
        menteeId: "mentee-1",
        mentorId: "mentor-1",
        scheduledTime: new Date("2026-09-04T10:30:00.000Z"),
      }];
    },
  };
  const job = createMeetingReminderJob({ meetingRepository, notificationService });

  await job.run(new Date("2026-09-02T10:00:00.000Z"));

  assert.equal(notifications.length, 4);
  assert.deepEqual(
    new Set(notifications.map(({ type }) => type)),
    new Set([NOTIFICATION_TYPES.MEETING_REMINDER, NOTIFICATION_TYPES.ARRIVAL_CHECK]),
  );
  assert.deepEqual(
    new Set(notifications.map(({ recipientId }) => recipientId)),
    new Set(["mentee-1", "mentor-1"]),
  );
});

test("post-meeting job asks both participants whether the meeting happened", async () => {
  const { notifications, notificationService } = createNotificationCollector();
  const meetingRepository = {
    async findMeetingsAwaitingOutcome() {
      return [{
        id: "meeting-1",
        menteeId: "mentee-1",
        mentorId: "mentor-1",
        scheduledTime: new Date("2026-09-02T09:00:00.000Z"),
      }];
    },
  };
  const job = createPostMeetingCheckJob({ meetingRepository, notificationService });

  await job.run(new Date("2026-09-02T10:00:00.000Z"));

  assert.equal(notifications.length, 2);
  assert.ok(notifications.every(({ type }) => type === NOTIFICATION_TYPES.POST_MEETING_CHECK));
});

test("feedback reminder job sends once per completed two-day period", async () => {
  const { notifications, notificationService } = createNotificationCollector();
  const feedbackRepository = {
    async findOutstandingFeedbackRequests() {
      return [
        {
          meetingId: "meeting-1",
          recipientId: "user-1",
          feedbackRequestedAt: new Date("2026-08-29T10:00:00.000Z"),
        },
        {
          meetingId: "meeting-2",
          recipientId: "user-2",
          feedbackRequestedAt: new Date("2026-09-01T10:00:00.000Z"),
        },
      ];
    },
  };
  const job = createFeedbackReminderJob({ feedbackRepository, notificationService });

  await job.run(new Date("2026-09-02T10:00:00.000Z"));

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientId, "user-1");
  assert.equal(notifications[0].deduplicationKey, "feedback_reminder:meeting-1:user-1:2");
});

test("notification jobs use one configurable cron schedule", async () => {
  const scheduledCallbacks = [];
  const scheduler = {
    schedule(expression, callback) {
      scheduledCallbacks.push({ expression, callback });
      return { stop() {} };
    },
  };
  const runOrder = [];
  const jobs = {
    meetingReminderJob: { async run() { runOrder.push("meeting"); } },
    postMeetingCheckJob: { async run() { runOrder.push("post-meeting"); } },
    feedbackReminderJob: { async run() { runOrder.push("feedback"); } },
  };

  startNotificationJobs({ scheduler, cronExpression: "*/5 * * * *", ...jobs });
  await scheduledCallbacks[0].callback();

  assert.equal(scheduledCallbacks[0].expression, "*/5 * * * *");
  assert.deepEqual(runOrder, ["meeting", "post-meeting", "feedback"]);
});
