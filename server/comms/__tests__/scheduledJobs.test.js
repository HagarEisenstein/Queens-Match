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
  const attendanceNotifications = notifications.filter(
    ({ type }) => type === NOTIFICATION_TYPES.ARRIVAL_CHECK,
  );
  assert.equal(attendanceNotifications.length, 2);
  assert.ok(attendanceNotifications.every(({ title }) => title === "Confirm attendance"));
  assert.ok(attendanceNotifications.every(({ actionUrl }) => actionUrl === "/meetings/meeting-1/arrival"));
  assert.ok(attendanceNotifications.every(({ emailEligible }) => emailEligible === true));
  const meetingNotifications = notifications.filter(
    ({ type }) => type === NOTIFICATION_TYPES.MEETING_REMINDER,
  );
  assert.ok(meetingNotifications.every(({ emailEligible }) => emailEligible === false));
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
  assert.ok(notifications.every(({ actionUrl }) => actionUrl === "/meetings/meeting-1/outcome"));
  assert.deepEqual(
    notifications.map(({ recipientId }) => recipientId).sort(),
    ["mentee-1", "mentor-1"],
  );
  assert.ok(notifications.every(({ emailEligible }) => emailEligible === true));
  assert.ok(notifications.every(({ emailDelayMilliseconds }) => emailDelayMilliseconds === 0));
});

test("post-meeting job deduplicates prompts across repeated cron runs", async () => {
  const keys = new Set();
  const notifications = [];
  const notificationService = {
    async send(notification) {
      if (keys.has(notification.deduplicationKey)) {
        return { id: "existing", ...notification };
      }
      keys.add(notification.deduplicationKey);
      notifications.push(notification);
      return { id: `n-${notifications.length}`, ...notification };
    },
  };
  const meetingRepository = {
    async findMeetingsAwaitingOutcome() {
      return [{
        id: "meeting-1",
        menteeId: "mentee-1",
        mentorId: "mentor-1",
        status: "scheduled",
        scheduledTime: new Date("2026-09-02T09:00:00.000Z"),
      }];
    },
  };
  const job = createPostMeetingCheckJob({ meetingRepository, notificationService });

  await job.run(new Date("2026-09-02T10:00:00.000Z"));
  await job.run(new Date("2026-09-02T10:05:00.000Z"));

  assert.equal(notifications.length, 2);
  assert.deepEqual(
    notifications.map(({ deduplicationKey }) => deduplicationKey).sort(),
    [
      "post_meeting_check:meeting-1:mentee-1",
      "post_meeting_check:meeting-1:mentor-1",
    ],
  );
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
  assert.equal(notifications[0].actionUrl, "/meetings/meeting-1/feedback");
  assert.equal(notifications[0].emailEligible, false);
  assert.equal(notifications[0].deduplicationKey, "feedback_reminder:meeting-1:user-1:2");
});

test("first feedback reminder is email eligible and links to feedback", async () => {
  const { notifications, notificationService } = createNotificationCollector();
  const feedbackRepository = {
    async findOutstandingFeedbackRequests() {
      return [{
        meetingId: "meeting-1",
        recipientId: "user-1",
        feedbackRequestedAt: new Date("2026-08-31T10:00:00.000Z"),
      }];
    },
  };
  const job = createFeedbackReminderJob({ feedbackRepository, notificationService });

  await job.run(new Date("2026-09-02T10:00:00.000Z"));

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].actionUrl, "/meetings/meeting-1/feedback");
  assert.equal(notifications[0].emailEligible, true);
  assert.equal(notifications[0].deduplicationKey, "feedback_reminder:meeting-1:user-1:1");
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

test("notification jobs skip overlapping cron ticks", async () => {
  let callback;
  let releaseFirstRun;
  const firstRunBlocked = new Promise((resolve) => {
    releaseFirstRun = resolve;
  });
  let meetingRuns = 0;
  const scheduler = {
    schedule(_expression, scheduledCallback) {
      callback = scheduledCallback;
      return { stop() {} };
    },
  };
  const jobs = {
    meetingReminderJob: {
      async run() {
        meetingRuns += 1;
        await firstRunBlocked;
      },
    },
    postMeetingCheckJob: { async run() {} },
    feedbackReminderJob: { async run() {} },
  };

  startNotificationJobs({ scheduler, ...jobs });
  const firstTick = callback();
  const overlappingTick = callback();
  await overlappingTick;

  assert.equal(meetingRuns, 1);
  releaseFirstRun();
  await firstTick;
});
