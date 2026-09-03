function createPrismaNotificationRepository(prisma) {
  return {
    findByDeduplicationKey: (deduplicationKey) => prisma.notification.findUnique({ where: { deduplicationKey } }),
    create: (data) => prisma.notification.create({ data }),
    createWithDeliveries: (data, deliveries) => prisma.$transaction(async (transaction) => {
      const notification = await transaction.notification.create({ data });
      await transaction.notificationDelivery.createMany({
        data: deliveries.map((delivery) => ({ notificationId: notification.id, ...delivery })),
      });
      return notification;
    }),
    listForRecipient: (recipientId) => prisma.notification.findMany({
      where: { recipientId }, orderBy: { createdAt: "desc" }, take: 50,
    }),
    markRead: (id, recipientId, readAt) => prisma.notification.updateMany({
      where: { id, recipientId }, data: { readAt },
    }),
    markActionCompleted: (id, recipientId, completedAt) => prisma.notification.updateMany({
      where: { id, recipientId }, data: { readAt: completedAt, actionCompletedAt: completedAt },
    }),
  };
}

module.exports = { createPrismaNotificationRepository };
