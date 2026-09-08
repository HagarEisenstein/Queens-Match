/**
 * End-to-end wiring of the post-meeting flow with in-memory storage:
 *
 *   scheduled meeting whose time passed
 *     -> post-meeting check (in-app + email) for mentor and mentee
 *     -> both answer happened=true
 *     -> FeedbackRequest + in-app notification + email delivery for both
 *
 * The real notification center, delivery scheduling, feedback repository,
 * outcome aggregation and lifecycle writes all take part, so a regression in
 * any single seam fails here.
 */
const { createPostMeetingCheckJob } = require("../../comms/jobs/postMeetingCheckJob");
const { createNotificationCenterService } = require("../../comms/notificationCenterService");
const { createPrismaMeetingQueryRepository } = require("../repositories/prismaMeetingQueryRepository");
const { createPrismaFeedbackRepository } = require("../repositories/prismaFeedbackRepository");
const { createPrismaOutcomeRepository } = require("../repositories/prismaOutcomeRepository");
const { createPrismaMeetingLifecycleRepository } = require("../repositories/prismaMeetingLifecycleRepository");
const { createOutcomeService } = require("../outcomeService");
const { createFeedbackService } = require("../feedbackService");
const { createBlocklistService } = require("../blocklistService");

const MEETING_ID = "meeting-1";
const MENTOR = { id: "mentor-1", email: "mentor@example.com" };
const MENTEE = { id: "mentee-1", email: "mentee@example.com" };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("in" in condition) return condition.in.includes(row[key]);
      if ("lt" in condition) return row[key] != null && row[key] < condition.lt;
      if ("gte" in condition) return row[key] != null && row[key] >= condition.gte;
      return false;
    }
    return row[key] === condition;
  });
}

/** The slice of Prisma the engagement repositories actually use. */
function createFakePrisma(meeting) {
  const meetings = [meeting];
  const outcomes = [];
  const feedbackRequests = [];
  const feedbacks = [];
  let sequence = 0;
  const nextId = () => `row-${(sequence += 1)}`;

  return {
    meetings,
    outcomes,
    feedbackRequests,
    meeting: {
      findUnique: async ({ where }) => meetings.find((row) => row.id === where.id) || null,
      findMany: async ({ where = {} }) => meetings.filter((row) => matches(row, where)),
      update: async ({ where, data }) => {
        const row = meetings.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    meetingOutcomeResponse: {
      findMany: async ({ where = {} }) => outcomes.filter((row) => matches(row, where)),
      findUnique: async ({ where }) => {
        const { meetingId, respondentId } = where.meetingId_respondentId;
        return outcomes.find(
          (row) => row.meetingId === meetingId && row.respondentId === respondentId
        ) || null;
      },
      upsert: async ({ where, create, update }) => {
        const { meetingId, respondentId } = where.meetingId_respondentId;
        const existing = outcomes.find(
          (row) => row.meetingId === meetingId && row.respondentId === respondentId
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: nextId(), createdAt: new Date(), ...create };
        outcomes.push(row);
        return row;
      },
    },
    feedbackRequest: {
      createMany: async ({ data, skipDuplicates }) => {
        for (const item of data) {
          const duplicate = feedbackRequests.some(
            (row) => row.meetingId === item.meetingId && row.recipientId === item.recipientId
          );
          if (duplicate) {
            if (skipDuplicates) continue;
            throw new Error("Unique constraint failed on feedback_requests");
          }
          feedbackRequests.push({ id: nextId(), fulfilledAt: null, ...item });
        }
      },
      findMany: async ({ where = {} }) => {
        if (where.OR) {
          return feedbackRequests.filter((row) => where.OR.some((clause) => matches(row, clause)));
        }
        return feedbackRequests.filter((row) => matches(row, where));
      },
      findUnique: async ({ where }) => {
        const { meetingId, recipientId } = where.meetingId_recipientId;
        return feedbackRequests.find(
          (row) => row.meetingId === meetingId && row.recipientId === recipientId
        ) || null;
      },
      updateMany: async ({ where, data }) => {
        for (const row of feedbackRequests.filter((item) => matches(item, where))) {
          Object.assign(row, data);
        }
      },
    },
    feedback: {
      findMany: async () => feedbacks,
      findUnique: async () => null,
      create: async ({ data }) => {
        const row = { id: nextId(), createdAt: new Date(), ...data };
        feedbacks.push(row);
        return row;
      },
    },
  };
}

/** In-memory stand-ins for the notification/delivery/recipient repositories. */
function createNotificationStore() {
  const notifications = [];
  const deliveries = [];
  const emails = [];
  let sequence = 0;

  return {
    notifications,
    deliveries,
    emails,
    notificationRepository: {
      findByDeduplicationKey: async (key) =>
        notifications.find((row) => row.deduplicationKey === key) || null,
      createWithDeliveries: async (notification, notificationDeliveries) => {
        const saved = { id: `n-${(sequence += 1)}`, createdAt: new Date(), ...notification };
        notifications.push(saved);
        for (const delivery of notificationDeliveries) {
          deliveries.push({ id: `d-${deliveries.length + 1}`, notificationId: saved.id, ...delivery });
        }
        return saved;
      },
    },
    deliveryRepository: {
      create: async (delivery) => {
        deliveries.push({ id: `d-${deliveries.length + 1}`, ...delivery });
      },
      findPendingEmailDeliveryForNotification: async (notificationId) =>
        deliveries.find(
          (row) => row.notificationId === notificationId && row.channel === "EMAIL" && row.status === "PENDING"
        ) || null,
      markSent: async (id, data) => {
        const row = deliveries.find((delivery) => delivery.id === id);
        Object.assign(row, {
          status: "SENT",
          sentAt: data.sentAt,
          providerMessageId: data.providerMessageId,
          errorMessage: null,
        });
      },
      markFailed: async (id, errorMessage, nextAttemptAt) => {
        const row = deliveries.find((delivery) => delivery.id === id);
        Object.assign(row, { status: "PENDING", errorMessage, nextAttemptAt });
      },
    },
    recipientRepository: {
      findById: async (id) => [MENTOR, MENTEE].find((user) => user.id === id) || null,
    },
    emailProvider: {
      send: async (notification) => {
        emails.push(notification);
        return { providerMessageId: `smtp-${emails.length}` };
      },
    },
  };
}

function createFlow() {
  const meeting = {
    id: MEETING_ID,
    menteeId: MENTEE.id,
    mentorId: MENTOR.id,
    status: "scheduled",
    scheduledTime: new Date("2026-09-02T09:00:00.000Z"),
    retryAfterNoshowUsed: false,
  };
  const prisma = createFakePrisma(meeting);
  const store = createNotificationStore();
  const notificationService = createNotificationCenterService({
    notificationRepository: store.notificationRepository,
    deliveryRepository: store.deliveryRepository,
    recipientRepository: store.recipientRepository,
    emailProvider: store.emailProvider,
    realtimeHub: { publish() {} },
  });

  const meetingQueryPort = createPrismaMeetingQueryRepository(prisma);
  const feedbackRepository = createPrismaFeedbackRepository(prisma);
  const feedbackService = createFeedbackService({
    feedbackRepository,
    meetingQueryPort,
    notificationService,
  });
  const outcomeService = createOutcomeService({
    outcomeRepository: createPrismaOutcomeRepository(prisma),
    meetingQueryPort,
    meetingLifecyclePort: createPrismaMeetingLifecycleRepository(prisma),
    blocklistService: createBlocklistService({
      blocklistRepository: { findActive: async () => null, createBlock: async () => ({}) },
    }),
    feedbackService,
  });

  return {
    prisma,
    store,
    meeting,
    postMeetingCheckJob: createPostMeetingCheckJob({ meetingRepository: meetingQueryPort, notificationService }),
    outcomeService,
    feedbackRepository,
  };
}

const AFTER_MEETING = new Date("2026-09-02T10:00:00.000Z");

function ofType(store, type) {
  return store.notifications.filter((notification) => notification.type === type);
}

function deliveriesFor(store, type, channel) {
  const ids = ofType(store, type).map((notification) => notification.id);
  return store.deliveries.filter(
    (delivery) => ids.includes(delivery.notificationId) && delivery.channel === channel
  );
}

describe("post-meeting check to feedback flow", () => {
  it("prompts both participants about a scheduled meeting whose time has passed", async () => {
    const flow = createFlow();

    await flow.postMeetingCheckJob.run(AFTER_MEETING);

    const prompts = ofType(flow.store, "post_meeting_check");
    expect(prompts.map((prompt) => prompt.recipientId).sort()).toEqual(["mentee-1", "mentor-1"]);
    expect(prompts.every((prompt) => prompt.actionUrl === `/meetings/${MEETING_ID}/outcome`)).toBe(true);
    // The meeting is still only "scheduled" — nobody clicked arrival.
    expect(flow.meeting.status).toBe("scheduled");
  });

  it("delivers the post-meeting check in-app and by email", async () => {
    const flow = createFlow();

    await flow.postMeetingCheckJob.run(AFTER_MEETING);

    expect(deliveriesFor(flow.store, "post_meeting_check", "IN_APP")).toHaveLength(2);
    const emailDeliveries = deliveriesFor(flow.store, "post_meeting_check", "EMAIL");
    expect(emailDeliveries).toHaveLength(2);
    expect(emailDeliveries.every((delivery) => delivery.status === "SENT")).toBe(true);
    expect(flow.store.emails.map((email) => email.recipient.email).sort()).toEqual([
      "mentee@example.com",
      "mentor@example.com",
    ]);
  });

  it("requests feedback from both sides once both confirm the meeting happened", async () => {
    const flow = createFlow();
    await flow.postMeetingCheckJob.run(AFTER_MEETING);

    await flow.outcomeService.submitOutcome(MEETING_ID, { id: MENTEE.id }, { happened: true });
    expect(await flow.feedbackRepository.findOutstandingFeedbackRequests()).toHaveLength(0);
    expect(ofType(flow.store, "feedback_request")).toHaveLength(0);

    const result = await flow.outcomeService.submitOutcome(MEETING_ID, { id: MENTOR.id }, { happened: true });

    expect(result.aggregation.status).toBe("completed");
    expect(flow.meeting.status).toBe("completed");

    const requests = flow.prisma.feedbackRequests;
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.recipientId).sort()).toEqual(["mentee-1", "mentor-1"]);

    const feedbackNotifications = ofType(flow.store, "feedback_request");
    expect(feedbackNotifications.map((item) => item.recipientId).sort()).toEqual(["mentee-1", "mentor-1"]);
    expect(feedbackNotifications.every((item) => item.actionUrl === `/meetings/${MEETING_ID}/feedback`)).toBe(true);

    expect(deliveriesFor(flow.store, "feedback_request", "IN_APP")).toHaveLength(2);
    const feedbackEmails = deliveriesFor(flow.store, "feedback_request", "EMAIL");
    expect(feedbackEmails).toHaveLength(2);
    expect(feedbackEmails.every((delivery) => delivery.status === "SENT")).toBe(true);
    expect(
      flow.store.emails
        .filter((email) => email.type === "feedback_request")
        .map((email) => email.recipient.email)
        .sort()
    ).toEqual(["mentee@example.com", "mentor@example.com"]);
  });

  it("does not duplicate prompts, requests or emails across repeated runs", async () => {
    const flow = createFlow();

    await flow.postMeetingCheckJob.run(AFTER_MEETING);
    await flow.postMeetingCheckJob.run(new Date("2026-09-02T10:05:00.000Z"));

    await flow.outcomeService.submitOutcome(MEETING_ID, { id: MENTEE.id }, { happened: true });
    await flow.outcomeService.submitOutcome(MEETING_ID, { id: MENTOR.id }, { happened: true });
    // A participant re-opening the outcome page and answering again.
    await flow.outcomeService.submitOutcome(MEETING_ID, { id: MENTOR.id }, { happened: true });
    await flow.postMeetingCheckJob.run(new Date("2026-09-02T10:10:00.000Z"));

    expect(ofType(flow.store, "post_meeting_check")).toHaveLength(2);
    expect(ofType(flow.store, "feedback_request")).toHaveLength(2);
    expect(flow.prisma.feedbackRequests).toHaveLength(2);
    expect(flow.store.deliveries.filter((delivery) => delivery.channel === "EMAIL")).toHaveLength(4);
    expect(flow.store.emails).toHaveLength(4);
  });
});
