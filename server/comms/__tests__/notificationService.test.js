const test = require("node:test");
const assert = require("node:assert/strict");
const { createNotificationService } = require("../notificationService");

function createDependencies(providerSend) {
  const records = [];
  const notificationLogRepository = {
    async findSentByDeduplicationKey(deduplicationKey) {
      return records.find(
        (record) => record.deduplicationKey === deduplicationKey && record.status === "sent",
      ) || null;
    },
    async create(record) {
      records.push(record);
      return record;
    },
  };

  return {
    records,
    notificationLogRepository,
    recipientRepository: {
      async findById(recipientId) {
        return { id: recipientId, email: `${recipientId}@example.com` };
      },
    },
    provider: {
      channel: "console",
      send: providerSend,
    },
  };
}

test("sends and logs a notification", async () => {
  const sentNotifications = [];
  const dependencies = createDependencies(async (notification) => {
    sentNotifications.push(notification);
    return { providerMessageId: "message-1" };
  });
  const notificationService = createNotificationService({
    ...dependencies,
    now: () => new Date("2026-09-02T10:00:00.000Z"),
  });

  const result = await notificationService.send({
    recipientId: "mentor-1",
    meetingId: "meeting-1",
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    deduplicationKey: "meeting_reminder:meeting-1:mentor-1",
  });

  assert.equal(sentNotifications.length, 1);
  assert.equal(sentNotifications[0].recipient.email, "mentor-1@example.com");
  assert.equal(result.status, "sent");
  assert.equal(result.channel, "console");
  assert.equal(result.providerMessageId, "message-1");
  assert.equal(dependencies.records.length, 1);
});

test("does not send a notification with an existing deduplication key", async () => {
  let sendCount = 0;
  const dependencies = createDependencies(async () => {
    sendCount += 1;
    return {};
  });
  const notificationService = createNotificationService(dependencies);
  const notification = {
    recipientId: "mentor-1",
    meetingId: "meeting-1",
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    deduplicationKey: "meeting_reminder:meeting-1:mentor-1",
  };

  const firstResult = await notificationService.send(notification);
  const secondResult = await notificationService.send(notification);

  assert.equal(sendCount, 1);
  assert.strictEqual(secondResult, firstResult);
});

test("logs failed notification attempts and preserves the provider error", async () => {
  const providerError = new Error("Provider unavailable");
  const dependencies = createDependencies(async () => {
    throw providerError;
  });
  const notificationService = createNotificationService({
    ...dependencies,
    now: () => new Date("2026-09-02T10:00:00.000Z"),
  });

  await assert.rejects(
    notificationService.send({
      recipientId: "mentor-1",
      meetingId: "meeting-1",
      type: "meeting_reminder",
      title: "Meeting reminder",
      message: "Your meeting starts soon",
      deduplicationKey: "meeting_reminder:meeting-1:mentor-1",
    }),
    providerError,
  );

  assert.equal(dependencies.records.length, 1);
  assert.equal(dependencies.records[0].status, "failed");
  assert.equal(dependencies.records[0].errorMessage, "Provider unavailable");
});

test("retries delivery after a failed notification attempt", async () => {
  let sendCount = 0;
  const dependencies = createDependencies(async () => {
    sendCount += 1;
    if (sendCount === 1) {
      throw new Error("Temporary provider failure");
    }
    return { providerMessageId: "message-2" };
  });
  const notificationService = createNotificationService(dependencies);
  const notification = {
    recipientId: "mentor-1",
    meetingId: "meeting-1",
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    deduplicationKey: "meeting_reminder:meeting-1:mentor-1",
  };

  await assert.rejects(notificationService.send(notification), /Temporary provider failure/);
  const result = await notificationService.send(notification);

  assert.equal(sendCount, 2);
  assert.equal(result.status, "sent");
  assert.equal(dependencies.records.length, 2);
});
