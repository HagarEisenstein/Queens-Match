function createPrismaRecipientRepository(prisma) {
  return {
    findById(recipientId) {
      return prisma.user.findUnique({
        where: { id: recipientId },
        select: { id: true, email: true, fullName: true },
      });
    },
  };
}

module.exports = { createPrismaRecipientRepository };
