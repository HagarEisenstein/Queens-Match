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
  eventBus.emit("MeetingRejected", { meetingId: "meeting-1", menteeId: "mentee-1" });
  eventBus.emit("MeetingMatched", {
    meetingId: "meeting-1",
    mentorId: "mentor-1",
    scheduledTime: "2026-09-10T15:00:00.000Z",
  });
  eventBus.emit("MeetingCompleted", { meetingId: "meeting-1", mentorId: "mentor-1" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    notifications.map(({ recipientId, type }) => ({ recipientId, type })),
    [
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.REQUEST_RECEIVED },
      { recipientId: "mentee-1", type: NOTIFICATION_TYPES.TIMES_OFFERED },
      { recipientId: "mentee-1", type: NOTIFICATION_TYPES.MEETING_REJECTED },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MEETING_MATCHED },
      { recipientId: "mentor-1", type: NOTIFICATION_TYPES.MENTOR_THANK_YOU },
    ],
  );

  unregisterHandlers();
  assert.equal(eventBus.listenerCount("MeetingMatched"), 1);
  assert.strictEqual(eventBus.listeners("MeetingMatched")[0], unrelatedHandler);
});
