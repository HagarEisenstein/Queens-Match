const test = require("node:test");
const assert = require("node:assert/strict");
const { createNotificationCenterService } = require("../notificationCenterService");

test("persists one in-app notification, schedules email, and publishes it", async () => {
  const notifications = [];
  const deliveries = [];
  const published = [];
  const notificationRepository = {
    findByDeduplicationKey: async (key) => notifications.find((item) => item.deduplicationKey === key),
    create: async (item) => { const saved = { id: "n1", createdAt: new Date(), ...item }; notifications.push(saved); return saved; },
  };
  const deliveryRepository = { create: async (item) => { deliveries.push(item); return item; } };
  const service = createNotificationCenterService({
    notificationRepository,
    deliveryRepository,
    realtimeHub: { publish: (userId, notification) => published.push({ userId, notification }) },
    emailDelayMilliseconds: 60 * 60 * 1000,
    now: () => new Date("2026-09-03T10:00:00Z"),
  });

  const input = {
    recipientId: "u1", type: "meeting_matched", title: "Meeting scheduled",
    message: "Your meeting was scheduled", meetingId: "m1", actionUrl: "/meetings/m1",
    deduplicationKey: "meeting_matched:m1:u1", emailEligible: true,
  };
  const first = await service.send(input);
  const second = await service.send(input);

  assert.equal(first.id, "n1");
  assert.strictEqual(second, first);
  assert.equal(notifications.length, 1);
  assert.deepEqual(deliveries.map((item) => item.channel), ["IN_APP", "EMAIL"]);
  assert.equal(deliveries[1].status, "PENDING");
  assert.equal(deliveries[1].nextAttemptAt.toISOString(), "2026-09-03T11:00:00.000Z");
  assert.equal(published.length, 1);
});

test("does not create an email delivery for quiet in-app notifications", async () => {
  const deliveries = [];
  const service = createNotificationCenterService({
    notificationRepository: {
      findByDeduplicationKey: async () => null,
      create: async (item) => ({ id: "n2", ...item }),
    },
    deliveryRepository: { create: async (item) => deliveries.push(item) },
    realtimeHub: { publish() {} },
  });

  await service.send({ recipientId: "u1", type: "mentor_thank_you", title: "Thanks", message: "Thanks", deduplicationKey: "thanks:m1:u1" });
  assert.deepEqual(deliveries.map((item) => item.channel), ["IN_APP"]);
});
