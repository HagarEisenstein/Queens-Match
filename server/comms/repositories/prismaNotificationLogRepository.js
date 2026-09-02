function createPrismaNotificationLogRepository(prisma) {
  return {
    findSentByDeduplicationKey(deduplicationKey) {
      return prisma.notificationLog.findFirst({
        where: { deduplicationKey, status: "sent" },
      });
    },
    create(notificationLog) {
      return prisma.notificationLog.create({ data: notificationLog });
    },
  };
}

module.exports = { createPrismaNotificationLogRepository };
