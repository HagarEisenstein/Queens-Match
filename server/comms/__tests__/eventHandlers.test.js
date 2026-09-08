const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { registerNotificationEventHandlers } = require("../registerEventHandlers");
const { NOTIFICATION_TYPES } = require("../notificationTypes");

test("meeting events create notifications for the correct recipients", async () => {
  const eventBus = new EventEmitter();
  const notifications = [];
  const notificationService = {
    async send(notification) {
      notifications.push(notification);
    },
  };
  const unrelatedHandler = () => {};
  eventBus.on("MeetingMatched", unrelatedHandler);
  const unregisterHandlers = registerNotificationEventHandlers({ eventBus, notificationService });

  eventBus.emit("MeetingRequested", { meetingId: "meeting-1", mentorId: "mentor-1" });
  eventBus.emit("TimesOffered", { meetingId: "meeting-1", menteeId: "mentee-1" });
  eventBus.emit("MoreTimesRequested", { meetingId: "meeting-1", mentorId: "mentor-1" });
  eventBus.emit("MeetingRejected", { meetingId: "meeting-1", menteeId: "mentee-1" });
  eventBus.emit("MeetingDeclined", { meetingId: "meeting-1", mentorId: "mentor-1" });
  eventBus.emit("MeetingMatched", {
    meetingId: "meeting-1",
    mentorId: "mentor-1",
    menteeId: "mentee-1",
    scheduledTime: "2026-09-10T15:00:00.000Z",
  });
  eventBus.emit("MeetingCompleted", { meetingId: "meeting-1", mentorId: "mentor-1" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    notifications.map(({ recipientId, type, actionUrl }) => ({ recipientId, type, actionUrl })),
    [
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.REQUEST_RECEIVED, actionUrl: "/meetings/meeting-1?action=offer-times" },
      { recipientId: "mentee-1", type: NOTIFICATION_TYPES.TIMES_OFFERED, actionUrl: "/meetings/meeting-1" },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MORE_TIMES_REQUESTED, actionUrl: "/meetings/meeting-1?action=offer-times" },
      { recipientId: "mentee-1", type: NOTIFICATION_TYPES.MEETING_REJECTED, actionUrl: "/meetings/meeting-1" },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MEETING_DECLINED, actionUrl: "/meetings/meeting-1" },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MEETING_MATCHED, actionUrl: "/meetings/meeting-1" },
      { recipientId: "mentee-1", type: NOTIFICATION_TYPES.MEETING_MATCHED, actionUrl: "/meetings/meeting-1" },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MENTOR_THANK_YOU, actionUrl: "/meetings/meeting-1" },
    ],
  );

  const confirmations = notifications.filter(
    ({ type }) => type === NOTIFICATION_TYPES.MEETING_MATCHED,
  );
  assert.ok(confirmations.every(({ title }) => title === "Meeting confirmed"));
  assert.ok(confirmations.every(({ emailDelayMilliseconds }) => emailDelayMilliseconds === 0));
  assert.equal(new Set(confirmations.map(({ deduplicationKey }) => deduplicationKey)).size, 2);

  unregisterHandlers();
  assert.equal(eventBus.listenerCount("MeetingMatched"), 1);
  assert.strictEqual(eventBus.listeners("MeetingMatched")[0], unrelatedHandler);
});
