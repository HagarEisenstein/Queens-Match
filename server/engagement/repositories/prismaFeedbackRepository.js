function mapFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meetingId,
    submittedBy: row.submittedBy,
    rating: row.rating,
    openText: row.openText,
    createdAt: row.createdAt,
  };
}

function mapFeedbackRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meetingId,
    recipientId: row.recipientId,
    feedbackRequestedAt: row.feedbackRequestedAt,
    fulfilledAt: row.fulfilledAt,
  };
}

function createPrismaFeedbackRepository(prisma) {
  return {
    async findByMeetingId(meetingId) {
      const rows = await prisma.feedback.findMany({
        where: { meetingId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapFeedback);
    },

    async findByMeetingAndSubmitter(meetingId, submittedBy) {
      const row = await prisma.feedback.findUnique({
        where: {
          meetingId_submittedBy: { meetingId, submittedBy },
        },
      });
      return mapFeedback(row);
    },

    async createFeedback({ meetingId, submittedBy, rating, openText }) {
      const row = await prisma.feedback.create({
        data: {
          meetingId,
          submittedBy,
          rating,
          openText: openText ?? null,
        },
      });
      return mapFeedback(row);
    },

    async createFeedbackRequests(requests) {
      if (!requests.length) return [];
      await prisma.feedbackRequest.createMany({
        data: requests.map((request) => ({
          meetingId: request.meetingId,
          recipientId: request.recipientId,
          feedbackRequestedAt: request.feedbackRequestedAt || new Date(),
        })),
        skipDuplicates: true,
      });
      return prisma.feedbackRequest.findMany({
        where: {
          OR: requests.map((request) => ({
            meetingId: request.meetingId,
            recipientId: request.recipientId,
          })),
        },
      }).then((rows) => rows.map(mapFeedbackRequest));
    },

    async markFeedbackRequestFulfilled(meetingId, recipientId) {
      await prisma.feedbackRequest.updateMany({
        where: {
          meetingId,
          recipientId,
          fulfilledAt: null,
        },
        data: { fulfilledAt: new Date() },
      });
    },

    async findOutstandingFeedbackRequests() {
      const rows = await prisma.feedbackRequest.findMany({
        where: { fulfilledAt: null },
        orderBy: { feedbackRequestedAt: "asc" },
      });
      return rows.map(mapFeedbackRequest);
    },
  };
}

module.exports = { createPrismaFeedbackRepository };
