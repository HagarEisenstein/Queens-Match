const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { registerNotificationEventHandlers } = require("../registerEventHandlers");
const { createNotificationCenterService } = require("../notificationCenterService");
const { NOTIFICATION_TYPES } = require("../notificationTypes");

test("sequential MeetingMatched emits persist only one notification", async () => {
  const eventBus = new EventEmitter();
  const notifications = [];
  const deliveries = [];

  const notificationRepository = {
    async findByDeduplicationKey(key) {
      return notifications.find((item) => item.deduplicationKey === key) || null;
    },
    async create(item) {
      const saved = { id: `n-${notifications.length + 1}`, ...item };
      notifications.push(saved);
      return saved;
    },
  };
  const deliveryRepository = {
    async create(item) {
      deliveries.push(item);
      return item;
    },
  };
  const notificationService = createNotificationCenterService({
    notificationRepository,
    deliveryRepository,
    realtimeHub: { publish() {} },
  });

  const unregister = registerNotificationEventHandlers({
    eventBus,
    notificationService,
  });

  const payload = {
    meetingId: "11111111-1111-1111-1111-111111111111",
    mentorId: "22222222-2222-2222-2222-222222222222",
    scheduledTime: "2026-09-10T15:00:00.000Z",
  };

  eventBus.emit("MeetingMatched", payload);
  await new Promise((resolve) => setImmediate(resolve));
  eventBus.emit("MeetingMatched", payload);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, NOTIFICATION_TYPES.MEETING_MATCHED);
  assert.equal(
    notifications[0].deduplicationKey,
    `${NOTIFICATION_TYPES.MEETING_MATCHED}:${payload.meetingId}:${payload.mentorId}:${payload.scheduledTime}`
  );

  unregister();
});
