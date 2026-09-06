const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmailWorker } = require("../jobs/emailWorker");

function delivery(id, attemptCount = 1) {
  return {
    id,
    attemptCount,
    notification: {
      id: `notification-${id}`,
      readAt: null,
      actionCompletedAt: null,
      recipient: { id: `user-${id}`, email: `${id}@example.com` },
      title: "Test",
      message: "Test message",
    },
  };
}

test("worker claims and processes deliveries concurrently", async () => {
  const processed = [];
  let active = 0;
  let peak = 0;
  const deliveryRepository = {
    async claimPendingEmailDeliveries() { return [delivery("one"), delivery("two"), delivery("three")]; },
    async markSent(id) { processed.push(id); active -= 1; },
    async markFailed() { assert.fail("unexpected failure"); },
  };
  const worker = createEmailWorker({
    deliveryRepository,
    concurrency: 2,
    emailProvider: {
      async send() {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setImmediate(resolve));
        return { providerMessageId: "provider-id" };
      },
    },
  });

  const result = await worker.run(new Date("2026-09-06T12:00:00Z"));
  assert.equal(result.processed, 3);
  assert.equal(peak, 2);
  assert.deepEqual(processed.sort(), ["one", "three", "two"]);
});

test("worker applies exponential retry and terminal failure policy", async () => {
  const failures = [];
  const deliveryRepository = {
    async claimPendingEmailDeliveries() { return [delivery("retry", 2), delivery("terminal", 3)]; },
    async markFailed(id, message, retryAt, options) { failures.push({ id, message, retryAt, ...options }); },
  };
  const worker = createEmailWorker({
    deliveryRepository,
    emailProvider: { async send() { throw new Error("provider timeout"); } },
    maxAttempts: 3,
    retryBaseMilliseconds: 1000,
    logger: { error() {} },
  });

  await worker.run(new Date("2026-09-06T12:00:00Z"));
  assert.equal(failures.find(({ id }) => id === "retry").retryAt.toISOString(), "2026-09-06T12:00:02.000Z");
  assert.deepEqual(failures.find(({ id }) => id === "terminal"), {
    id: "terminal", message: "provider timeout", retryAt: null, terminal: true,
  });
});

test("worker skips overlapping runs", async () => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let claims = 0;
  const worker = createEmailWorker({
    deliveryRepository: {
      async claimPendingEmailDeliveries() { claims += 1; return [delivery("one")]; },
      async markSent() { await blocked; },
    },
    emailProvider: { async send() { return { providerMessageId: null }; } },
  });

  const firstRun = worker.run();
  const secondRun = await worker.run();
  assert.deepEqual(secondRun, { skipped: true, processed: 0 });
  release();
  await firstRun;
  assert.equal(claims, 1);
});
