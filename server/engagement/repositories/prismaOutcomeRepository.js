function mapOutcome(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meetingId,
    respondentId: row.respondentId,
    role: row.role,
    happened: row.happened,
    absentParty: row.absentParty,
    stillWantToMeet: row.stillWantToMeet,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function createPrismaOutcomeRepository(prisma) {
  return {
    async findByMeetingId(meetingId) {
      const rows = await prisma.meetingOutcomeResponse.findMany({
        where: { meetingId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapOutcome);
    },

    async findByMeetingAndRespondent(meetingId, respondentId) {
      const row = await prisma.meetingOutcomeResponse.findUnique({
        where: {
          meetingId_respondentId: { meetingId, respondentId },
        },
      });
      return mapOutcome(row);
    },

    async upsertOutcome({
      meetingId,
      respondentId,
      role,
      happened,
      absentParty,
      stillWantToMeet,
    }) {
      const row = await prisma.meetingOutcomeResponse.upsert({
        where: {
          meetingId_respondentId: { meetingId, respondentId },
        },
        create: {
          meetingId,
          respondentId,
          role,
          happened,
          absentParty: absentParty ?? null,
          stillWantToMeet: stillWantToMeet ?? null,
        },
        update: {
          role,
          happened,
          absentParty: absentParty ?? null,
          stillWantToMeet: stillWantToMeet ?? null,
        },
      });
      return mapOutcome(row);
    },
  };
}

module.exports = { createPrismaOutcomeRepository };
