function createPrismaDeliveryRepository(prisma) {
  return {
    create: (data) => prisma.notificationDelivery.create({ data }),
    claimPendingEmailDeliveries: async (now, { limit = 100, staleAfter = 15 * 60 * 1000 } = {}) => {
      const staleBefore = new Date(now.getTime() - staleAfter);
      return prisma.$transaction(async (transaction) => {
        const claimed = await transaction.$queryRaw`
          WITH candidates AS (
            SELECT id
            FROM notification_deliveries
            WHERE channel = 'EMAIL'
              AND (
                (status = 'PENDING' AND next_attempt_at <= ${now})
                OR (status = 'PROCESSING' AND locked_at <= ${staleBefore})
              )
            ORDER BY next_attempt_at ASC NULLS FIRST, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${limit}
          )
          UPDATE notification_deliveries AS delivery
          SET status = 'PROCESSING', locked_at = ${now}, attempt_count = attempt_count + 1
          FROM candidates
          WHERE delivery.id = candidates.id
          RETURNING delivery.id
        `;
        const ids = claimed.map(({ id }) => id);
        if (!ids.length) return [];
        return transaction.notificationDelivery.findMany({
          where: { id: { in: ids } },
          include: { notification: { include: { recipient: { select: { id: true, email: true, phone: true } } } } },
        });
      });
    },
    findPendingEmailDeliveries: (now) => prisma.notificationDelivery.findMany({
      where: { channel: "EMAIL", status: "PENDING", nextAttemptAt: { lte: now } },
      include: { notification: { include: { recipient: { select: { id: true, email: true, phone: true } } } } },
      take: 100,
    }),
    markSent: (id, data) => prisma.notificationDelivery.update({
      where: { id }, data: { status: "SENT", lockedAt: null, sentAt: data.sentAt, providerMessageId: data.providerMessageId },
    }),
    markSkipped: (id) => prisma.notificationDelivery.update({ where: { id }, data: { status: "SKIPPED", lockedAt: null } }),
    markFailed: (id, errorMessage, nextAttemptAt, { terminal = false } = {}) => prisma.notificationDelivery.update({
      where: { id }, data: { status: terminal ? "FAILED" : "PENDING", lockedAt: null, errorMessage, nextAttemptAt },
    }),
  };
}

module.exports = { createPrismaDeliveryRepository };
