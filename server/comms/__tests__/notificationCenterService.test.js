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

test("mails important prompts immediately even when a digest delay is configured", async () => {
  for (const type of ["post_meeting_check", "feedback_request", "meeting_cancelled"]) {
    const deliveries = [];
    const sent = [];
    const service = createNotificationCenterService({
      notificationRepository: {
        findByDeduplicationKey: async () => null,
        create: async (item) => ({ id: `n-${type}`, ...item }),
      },
      deliveryRepository: {
        create: async (item) => {
          deliveries.push({ id: `d-${deliveries.length + 1}`, ...item });
        },
        findPendingEmailDeliveryForNotification: async (notificationId) =>
          deliveries.find(
            (delivery) => delivery.notificationId === notificationId && delivery.channel === "EMAIL",
          ) || null,
        markSent: async (id, data) => {
          const delivery = deliveries.find((item) => item.id === id);
          Object.assign(delivery, { status: "SENT", ...data, errorMessage: null });
        },
        markFailed: async () => {
          throw new Error(`markFailed should not be called for ${type}`);
        },
      },
      recipientRepository: { findById: async (id) => ({ id, email: "user@example.com" }) },
      emailProvider: {
        send: async (notification) => {
          sent.push(notification);
          return { providerMessageId: `provider-${type}` };
        },
      },
      realtimeHub: { publish() {} },
      // Production used to leave these queued for an hour, which lost them.
      emailDelayMilliseconds: 60 * 60 * 1000,
      now: () => new Date("2026-09-03T10:00:00Z"),
    });

    await service.send({
      recipientId: "u1",
      meetingId: "m1",
      type,
      title: "Important",
      message: "Act on this",
      deduplicationKey: `${type}:m1:u1`,
    });

    assert.deepEqual(deliveries.map((delivery) => delivery.channel), ["IN_APP", "EMAIL"], type);
    assert.equal(deliveries[1].status, "SENT", type);
    assert.equal(deliveries[1].errorMessage, null, type);
    assert.equal(deliveries[1].providerMessageId, `provider-${type}`, type);
    assert.equal(sent.length, 1, type);
  }
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

test("falls back to route defaults when callers omit the action URL", async () => {
  const notifications = [];
  const service = createNotificationCenterService({
    notificationRepository: {
      findByDeduplicationKey: async () => null,
      create: async (item) => {
        notifications.push(item);
        return { id: "n-default", ...item };
      },
    },
    deliveryRepository: { create: async () => {} },
    realtimeHub: { publish() {} },
  });

  await service.send({
    recipientId: "u1",
    meetingId: "m1",
    type: "post_meeting_check",
    title: "Did your meeting happen?",
    message: "Tell us what happened.",
    deduplicationKey: "post_meeting_check:m1:u1",
  });

  assert.equal(notifications[0].actionUrl, "/meetings/m1/outcome");
});

test("sends zero-delay emails immediately and marks the delivery sent", async () => {
  const notifications = [];
  const deliveries = [];
  const sent = [];
  const notificationRepository = {
    findByDeduplicationKey: async () => null,
    create: async (item) => {
      const saved = { id: "n-immediate", createdAt: new Date("2026-09-03T10:00:00Z"), ...item };
      notifications.push(saved);
      return saved;
    },
  };
  const deliveryRepository = {
    create: async (item) => {
      const saved = { id: `d-${deliveries.length + 1}`, ...item };
      deliveries.push(saved);
      return saved;
    },
    findPendingEmailDeliveryForNotification: async (notificationId) =>
      deliveries.find((delivery) => delivery.notificationId === notificationId && delivery.channel === "EMAIL" && delivery.status === "PENDING"),
    markSent: async (id, data) => {
      const delivery = deliveries.find((item) => item.id === id);
      Object.assign(delivery, { status: "SENT", sentAt: data.sentAt, providerMessageId: data.providerMessageId });
    },
    markFailed: async () => {
      throw new Error("markFailed should not be called");
    },
  };
  const service = createNotificationCenterService({
    notificationRepository,
    deliveryRepository,
    recipientRepository: {
      findById: async (recipientId) => ({ id: recipientId, email: "mentor@example.com" }),
    },
    emailProvider: {
      send: async (notification) => {
        sent.push(notification);
        return { providerMessageId: "provider-1" };
      },
    },
    realtimeHub: { publish() {} },
    now: () => new Date("2026-09-03T10:00:00Z"),
  });

  await service.send({
    recipientId: "mentor-1",
    type: "request_received",
    title: "New meeting request",
    message: "A mentee requested a meeting with you.",
    meetingId: "meeting-1",
    deduplicationKey: "request_received:meeting-1:mentor-1",
    emailEligible: true,
    emailDelayMilliseconds: 0,
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].recipient.email, "mentor@example.com");
  assert.equal(sent[0].actionUrl, "/meetings/meeting-1?action=offer-times");
  assert.equal(deliveries[1].status, "SENT");
  assert.equal(deliveries[1].providerMessageId, "provider-1");
});
