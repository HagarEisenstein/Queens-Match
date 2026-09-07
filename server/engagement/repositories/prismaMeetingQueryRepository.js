function createPrismaMeetingQueryRepository(prisma) {
  const participant = {
    id: true,
    username: true,
    fullName: true,
    photoUrl: true,
  };

  const include = {
    timeSlots: { orderBy: { startTime: "asc" } },
    mentee: { select: participant },
    mentor: { select: participant },
  };

  return {
    findById(meetingId) {
      return prisma.meeting.findUnique({ where: { id: meetingId }, include });
    },

    findScheduledMeetingsBetween({ scheduledFrom, scheduledUntil }) {
      return prisma.meeting.findMany({
        where: {
          status: "scheduled",
          scheduledTime: { gte: scheduledFrom, lt: scheduledUntil },
        },
        include,
      });
    },

    findMeetingsAwaitingOutcome({ before }) {
      return prisma.meeting.findMany({
        where: {
          status: "arrival_confirmed",
          scheduledTime: { lt: before },
        },
        include,
      });
    },
  };
}

module.exports = { createPrismaMeetingQueryRepository };
