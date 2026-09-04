function mapBlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    menteeId: row.menteeId,
    mentorId: row.mentorId,
    meetingId: row.meetingId,
    reason: row.reason,
    createdAt: row.createdAt,
    clearedAt: row.clearedAt,
  };
}

function createPrismaBlocklistRepository(prisma) {
  return {
    async findActive(menteeId, mentorId) {
      const row = await prisma.mentorMenteeBlock.findFirst({
        where: {
          menteeId,
          mentorId,
          clearedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      return mapBlock(row);
    },

    async listActive({ menteeId, mentorId } = {}) {
      const rows = await prisma.mentorMenteeBlock.findMany({
        where: {
          clearedAt: null,
          ...(menteeId ? { menteeId } : {}),
          ...(mentorId ? { mentorId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(mapBlock);
    },

    async createBlock({ menteeId, mentorId, meetingId, reason }) {
      const existing = await this.findActive(menteeId, mentorId);
      if (existing) return existing;

      const row = await prisma.mentorMenteeBlock.create({
        data: {
          menteeId,
          mentorId,
          meetingId: meetingId ?? null,
          reason: reason ?? null,
        },
      });
      return mapBlock(row);
    },

    async clearBlock(blockId) {
      const row = await prisma.mentorMenteeBlock.update({
        where: { id: blockId },
        data: { clearedAt: new Date() },
      });
      return mapBlock(row);
    },
  };
}

module.exports = { createPrismaBlocklistRepository };
