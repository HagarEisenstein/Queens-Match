const prisma = require("../commons/db");
const eventBus = require("../commons/eventBus");
const { createEmptyMeetingQueryPort } = require("./ports/meetingQueryPort");
const {
  createNoopMeetingLifecyclePort,
} = require("./ports/meetingLifecyclePort");
const {
  createPrismaOutcomeRepository,
} = require("./repositories/prismaOutcomeRepository");
const {
  createPrismaFeedbackRepository,
} = require("./repositories/prismaFeedbackRepository");
const {
  createPrismaBlocklistRepository,
} = require("./repositories/prismaBlocklistRepository");
const { createBlocklistService } = require("./blocklistService");
const { createFeedbackService } = require("./feedbackService");
const { createOutcomeService } = require("./outcomeService");
const { createEngagementRouter } = require("./routes");

function bootstrapEngagement({
  authenticate,
  notificationService,
  meetingQueryPort = createEmptyMeetingQueryPort(),
  meetingLifecyclePort = createNoopMeetingLifecyclePort(),
  outcomeRepository = createPrismaOutcomeRepository(prisma),
  feedbackRepository = createPrismaFeedbackRepository(prisma),
  blocklistRepository = createPrismaBlocklistRepository(prisma),
  bus = eventBus,
} = {}) {
  const blocklistService = createBlocklistService({ blocklistRepository });
  const feedbackService = createFeedbackService({
    feedbackRepository,
    meetingQueryPort,
    notificationService,
  });
  const outcomeService = createOutcomeService({
    outcomeRepository,
    meetingQueryPort,
    meetingLifecyclePort,
    blocklistService,
    feedbackService,
    eventBus: bus,
  });

  const router = createEngagementRouter({
    authenticate,
    outcomeService,
    feedbackService,
    blocklistService,
  });

  return {
    router,
    outcomeService,
    feedbackService,
    blocklistService,
    outcomeRepository,
    feedbackRepository,
    blocklistRepository,
    meetingQueryPort,
    meetingLifecyclePort,
  };
}

module.exports = { bootstrapEngagement };
