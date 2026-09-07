function createPrismaDeliveryRepository(prisma) {
  return {
    create: (data) => prisma.notificationDelivery.create({ data }),
    findPendingEmailDeliveries: (now) => prisma.notificationDelivery.findMany({
      where: { channel: "EMAIL", status: "PENDING", nextAttemptAt: { lte: now } },
      include: { notification: { include: { recipient: { select: { id: true, email: true, phone: true } } } } },
      take: 100,
    }),
    markSent: (id, data) => prisma.notificationDelivery.update({
      where: { id }, data: { status: "SENT", sentAt: data.sentAt, providerMessageId: data.providerMessageId, attemptCount: { increment: 1 } },
    }),
    markSkipped: (id) => prisma.notificationDelivery.update({ where: { id }, data: { status: "SKIPPED" } }),
    markFailed: (id, errorMessage, nextAttemptAt) => prisma.notificationDelivery.update({
      where: { id }, data: { status: "PENDING", errorMessage, nextAttemptAt, attemptCount: { increment: 1 } },
    }),
  };
}

module.exports = { createPrismaDeliveryRepository };
