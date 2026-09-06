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
    findOwnedById: (id, recipientId) => prisma.notification.findFirst({
      where: { id, recipientId },
    }),
    findAdminInviteForRecipient: (id, recipientId) => prisma.notification.findFirst({
      where: { id, recipientId, type: "ADMIN_INVITE" },
    }),
    findPendingAdminInvite: (invitedBy, recipientId) => prisma.notification.findFirst({
      where: {
        recipientId,
        type: "ADMIN_INVITE",
        status: "pending",
        metadata: {
          path: ["invitedBy"],
          equals: invitedBy,
        },
      },
    }),
    listAdminInvitesByInviter: (invitedBy) => prisma.notification.findMany({
      where: {
        type: "ADMIN_INVITE",
        metadata: {
          path: ["invitedBy"],
          equals: invitedBy,
        },
      },
      include: {
        recipient: {
          select: {
            id: true,
            email: true,
            username: true,
            fullName: true,
            roles: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    markRead: (id, recipientId, readAt) => prisma.notification.updateMany({
      where: { id, recipientId }, data: { readAt },
    }),
    markActionCompleted: (id, recipientId, completedAt) => prisma.notification.updateMany({
      where: { id, recipientId }, data: { readAt: completedAt, actionCompletedAt: completedAt },
    }),
    updateAdminInviteStatus: (id, recipientId, status, completedAt) => prisma.notification.updateMany({
      where: { id, recipientId, type: "ADMIN_INVITE", status: "pending" },
      data: {
        status,
        readAt: completedAt,
        actionCompletedAt: completedAt,
      },
    }),
  };
}

module.exports = { createPrismaNotificationRepository };
