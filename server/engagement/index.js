const { bootstrapEngagement } = require("./bootstrap");
const { aggregateOutcome } = require("./aggregateOutcome");
const { createEmptyMeetingQueryPort } = require("./ports/meetingQueryPort");
const {
  LIFECYCLE_EVENTS,
  createRecordingMeetingLifecyclePort,
  createNoopMeetingLifecyclePort,
} = require("./ports/meetingLifecyclePort");
const { createEngagementRouter } = require("./routes");
const { createBlocklistService } = require("./blocklistService");
const { createFeedbackService } = require("./feedbackService");
const { createOutcomeService } = require("./outcomeService");
const {
  createPrismaOutcomeRepository,
} = require("./repositories/prismaOutcomeRepository");
const {
  createPrismaFeedbackRepository,
} = require("./repositories/prismaFeedbackRepository");
const {
  createPrismaBlocklistRepository,
} = require("./repositories/prismaBlocklistRepository");
const {
  createPrismaMeetingQueryRepository,
} = require("./repositories/prismaMeetingQueryRepository");
const { createPrismaMeetingLifecycleRepository } = require("./repositories/prismaMeetingLifecycleRepository");

module.exports = {
  bootstrapEngagement,
  aggregateOutcome,
  createEmptyMeetingQueryPort,
  LIFECYCLE_EVENTS,
  createRecordingMeetingLifecyclePort,
  createNoopMeetingLifecyclePort,
  createEngagementRouter,
  createBlocklistService,
  createFeedbackService,
  createOutcomeService,
  createPrismaOutcomeRepository,
  createPrismaFeedbackRepository,
  createPrismaBlocklistRepository,
  createPrismaMeetingQueryRepository,
  createPrismaMeetingLifecycleRepository,
};
