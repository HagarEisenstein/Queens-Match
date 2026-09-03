const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmailFallbackJob } = require("../jobs/emailFallbackJob");

test("emails only unread actionable notifications whose delay elapsed", async () => {
  const updates = [];
  const sent = [];
  const deliveryRepository = {
    findPendingEmailDeliveries: async () => [
      { id: "d1", notification: { id: "n1", readAt: null, actionCompletedAt: null, recipient: { email: "a@example.com" }, title: "Hello", message: "Act" } },
      { id: "d2", notification: { id: "n2", readAt: new Date(), actionCompletedAt: null, recipient: { email: "b@example.com" }, title: "Read", message: "Skip" } },
    ],
    markSent: async (id, data) => updates.push({ id, status: "SENT", ...data }),
    markSkipped: async (id) => updates.push({ id, status: "SKIPPED" }),
    markFailed: async () => {},
  };
  const job = createEmailFallbackJob({
    deliveryRepository,
    emailProvider: { send: async (notification) => { sent.push(notification); return { providerMessageId: "email-1" }; } },
  });

  await job.run(new Date("2026-09-03T12:00:00Z"));
  assert.equal(sent.length, 1);
  assert.deepEqual(updates.map(({ id, status }) => ({ id, status })), [
    { id: "d1", status: "SENT" }, { id: "d2", status: "SKIPPED" },
  ]);
});
