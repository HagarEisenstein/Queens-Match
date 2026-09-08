const test = require("node:test");
const assert = require("node:assert/strict");
const { createPrismaDeliveryRepository } = require("../repositories/prismaDeliveryRepository");

function recordingPrisma() {
  const calls = [];
  return {
    calls,
    notificationDelivery: {
      create: async (args) => calls.push(["create", args]),
      findFirst: async (args) => {
        calls.push(["findFirst", args]);
        return null;
      },
      findMany: async (args) => {
        calls.push(["findMany", args]);
        return [];
      },
      update: async (args) => {
        calls.push(["update", args]);
        return args;
      },
    },
  };
}

test("a successful retry marks the delivery sent and clears the earlier error", async () => {
  const prisma = recordingPrisma();
  const repository = createPrismaDeliveryRepository(prisma);

  await repository.markSent("delivery-1", {
    sentAt: new Date("2026-09-03T10:00:00.000Z"),
    providerMessageId: "smtp-1",
  });

  const [, args] = prisma.calls.at(-1);
  assert.deepEqual(args, {
    where: { id: "delivery-1" },
    data: {
      status: "SENT",
      sentAt: new Date("2026-09-03T10:00:00.000Z"),
      providerMessageId: "smtp-1",
      // A delivery that previously failed must not keep its stale error.
      errorMessage: null,
      attemptCount: { increment: 1 },
    },
  });
});

test("a failed delivery keeps the error and stays retryable", async () => {
  const prisma = recordingPrisma();
  const repository = createPrismaDeliveryRepository(prisma);
  const retryAt = new Date("2026-09-03T11:00:00.000Z");

  await repository.markFailed("delivery-1", "Email send failed (ENETUNREACH): no route", retryAt);

  const [, args] = prisma.calls.at(-1);
  assert.equal(args.data.status, "PENDING");
  assert.equal(args.data.errorMessage, "Email send failed (ENETUNREACH): no route");
  assert.equal(args.data.nextAttemptAt, retryAt);
  assert.deepEqual(args.data.attemptCount, { increment: 1 });
});

test("the fallback job only picks up due email deliveries", async () => {
  const prisma = recordingPrisma();
  const repository = createPrismaDeliveryRepository(prisma);
  const now = new Date("2026-09-03T12:00:00.000Z");

  await repository.findPendingEmailDeliveries(now);

  const [, args] = prisma.calls.at(-1);
  assert.deepEqual(args.where, {
    channel: "EMAIL",
    status: "PENDING",
    nextAttemptAt: { lte: now },
  });
  // The provider needs the recipient address and the notification body.
  assert.ok(args.include.notification.include.recipient);
});
