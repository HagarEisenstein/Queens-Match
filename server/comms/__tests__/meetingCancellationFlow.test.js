const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const { registerNotificationEventHandlers } = require("../registerEventHandlers");
const { createNotificationCenterService } = require("../notificationCenterService");
const { NOTIFICATION_TYPES } = require("../notificationTypes");

const MEETING_ID = "meeting-1";
const MENTOR = { id: "mentor-1", email: "mentor@example.com" };
const MENTEE = { id: "mentee-1", email: "mentee@example.com" };
const ADMIN = { id: "admin-1", email: "admin@example.com" };

const CANCELLED_EVENT = {
  meetingId: MEETING_ID,
  mentorId: MENTOR.id,
  menteeId: MENTEE.id,
  cancelledBy: MENTEE.id,
  cancelledByRole: "mentee",
  cancelledByName: "Mia Mentee",
  scheduledTime: "2026-09-10T15:00:00.000Z",
  mentorName: "Nora Mentor",
  menteeName: "Mia Mentee",
};

function createHarness() {
  const notifications = [];
  const deliveries = [];
  const emails = [];
  const alerts = new Map();
  let sequence = 0;

  const notificationService = createNotificationCenterService({
    notificationRepository: {
      findByDeduplicationKey: async (key) =>
        notifications.find((item) => item.deduplicationKey === key) || null,
      createWithDeliveries: async (notification, notificationDeliveries) => {
        const saved = { id: `n-${(sequence += 1)}`, createdAt: new Date(), ...notification };
        notifications.push(saved);
        for (const delivery of notificationDeliveries) {
          deliveries.push({ id: `d-${deliveries.length + 1}`, notificationId: saved.id, ...delivery });
        }
        return saved;
      },
    },
    deliveryRepository: {
      create: async () => {},
      findPendingEmailDeliveryForNotification: async (notificationId) =>
        deliveries.find(
          (item) => item.notificationId === notificationId && item.channel === "EMAIL" && item.status === "PENDING"
        ) || null,
      markSent: async (id, data) => {
        const delivery = deliveries.find((item) => item.id === id);
        Object.assign(delivery, { status: "SENT", ...data, errorMessage: null });
      },
      markFailed: async (id, errorMessage) => {
        const delivery = deliveries.find((item) => item.id === id);
        Object.assign(delivery, { status: "PENDING", errorMessage });
      },
    },
    recipientRepository: {
      findById: async (id) => [MENTOR, MENTEE, ADMIN].find((user) => user.id === id) || null,
    },
    emailProvider: {
      send: async (notification) => {
        emails.push(notification);
        return { providerMessageId: `smtp-${emails.length}` };
      },
    },
    realtimeHub: { publish() {} },
  });

  const eventBus = new EventEmitter();
  const unregister = registerNotificationEventHandlers({
    eventBus,
    notificationService,
    logger: { info() {}, error() {} },
    adminRecipientRepository: { findAdmins: async () => [{ id: ADMIN.id }] },
    adminAlertService: {
      createAlert: async (alert) => {
        // Mirrors the upsert-on-idempotencyKey contract of adminAlertService.
        if (!alerts.has(alert.idempotencyKey)) alerts.set(alert.idempotencyKey, alert);
        return alerts.get(alert.idempotencyKey);
      },
    },
  });

  return { notifications, deliveries, emails, alerts, eventBus, unregister };
}

async function emitCancellation(harness, event = CANCELLED_EVENT) {
  harness.eventBus.emit("MeetingCancelled", event);
  // Handlers are fire-and-forget; drain the microtask queue.
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function emailDeliveriesFor(harness, recipientId) {
  const ids = harness.notifications
    .filter((notification) => notification.recipientId === recipientId)
    .map((notification) => notification.id);
  return harness.deliveries.filter(
    (delivery) => ids.includes(delivery.notificationId) && delivery.channel === "EMAIL"
  );
}

test("cancellation notifies the other participant in-app and by email", async () => {
  const harness = createHarness();

  await emitCancellation(harness);

  const participantNotification = harness.notifications.find(
    (notification) => notification.recipientId === MENTOR.id
  );
  assert.ok(participantNotification, "mentor should be notified");
  assert.equal(participantNotification.type, NOTIFICATION_TYPES.MEETING_CANCELLED);
  assert.equal(participantNotification.actionUrl, `/meetings/${MEETING_ID}`);
  assert.match(participantNotification.message, /cancelled by Mia Mentee/);
  assert.equal(participantNotification.deduplicationKey, `meeting_cancelled:${MEETING_ID}:${MENTOR.id}:initial`);

  const inApp = harness.deliveries.filter(
    (delivery) => delivery.notificationId === participantNotification.id && delivery.channel === "IN_APP"
  );
  assert.equal(inApp.length, 1);

  const mentorEmails = emailDeliveriesFor(harness, MENTOR.id);
  assert.equal(mentorEmails.length, 1);
  assert.equal(mentorEmails[0].status, "SENT");
  assert.ok(harness.emails.some((email) => email.recipient.email === "mentor@example.com"));

  // The person who cancelled is not notified about their own action.
  assert.equal(harness.notifications.some((item) => item.recipientId === MENTEE.id), false);
  harness.unregister();
});

test("cancellation raises an admin alert and emails every admin", async () => {
  const harness = createHarness();

  await emitCancellation(harness);

  const alert = harness.alerts.get(`cancelled_meeting:${MEETING_ID}`);
  assert.ok(alert, "a cancelled_meeting alert should exist");
  assert.equal(alert.alertType, "cancelled_meeting");
  assert.equal(alert.meetingId, MEETING_ID);
  assert.equal(alert.payload.cancelledBy, MENTEE.id);

  const adminNotification = harness.notifications.find(
    (notification) => notification.recipientId === ADMIN.id
  );
  assert.ok(adminNotification, "admin should be notified");
  assert.equal(adminNotification.type, NOTIFICATION_TYPES.MEETING_CANCELLED);
  for (const fragment of [
    "Meeting cancelled",
    `Meeting ID: ${MEETING_ID}`,
    "Mentor: Nora Mentor",
    "Mentee: Mia Mentee",
    "Scheduled time: 2026-09-10T15:00:00.000Z",
    "Cancelled by: Mia Mentee (mentee)",
  ]) {
    assert.ok(
      adminNotification.message.includes(fragment),
      `admin email should mention "${fragment}"`
    );
  }

  const adminEmails = emailDeliveriesFor(harness, ADMIN.id);
  assert.equal(adminEmails.length, 1);
  assert.equal(adminEmails[0].status, "SENT");
  assert.ok(harness.emails.some((email) => email.recipient.email === "admin@example.com"));
  harness.unregister();
});

test("repeated cancellation events do not duplicate notifications, emails or alerts", async () => {
  const harness = createHarness();

  await emitCancellation(harness);
  await emitCancellation(harness);
  await emitCancellation(harness);

  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.deliveries.filter((delivery) => delivery.channel === "EMAIL").length, 2);
  assert.equal(harness.emails.length, 2);
  assert.equal(harness.alerts.size, 1);
  harness.unregister();
});

test("an admin who is a participant is not emailed twice", async () => {
  const harness = createHarness();
  harness.unregister();

  const adminIsMentor = { ...CANCELLED_EVENT, mentorId: ADMIN.id, mentorName: "Admin Mentor" };
  const scoped = createHarness();
  await emitCancellation(scoped, adminIsMentor);

  assert.equal(scoped.notifications.length, 1);
  assert.equal(scoped.notifications[0].recipientId, ADMIN.id);
  assert.equal(scoped.notifications[0].deduplicationKey, `meeting_cancelled:${MEETING_ID}:${ADMIN.id}:initial`);
  assert.equal(scoped.alerts.size, 1);
  scoped.unregister();
});
