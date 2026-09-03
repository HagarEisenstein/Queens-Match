process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "engagement-test-secret";

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { EventEmitter } = require("events");
const { createApp } = require("../app");
const { createOutcomeService } = require("../engagement/outcomeService");
const { createFeedbackService } = require("../engagement/feedbackService");
const { createBlocklistService } = require("../engagement/blocklistService");
const {
  createRecordingMeetingLifecyclePort,
} = require("../engagement/ports/meetingLifecyclePort");
const { createEngagementRouter } = require("../engagement/routes");

const MEETING_ID = "11111111-1111-4111-8111-111111111111";
const MENTEE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MENTOR_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function tokenFor(id, roles = ["mentee"]) {
  return jwt.sign({ id, roles }, process.env.JWT_SECRET);
}

function createMemoryRepos() {
  const outcomes = [];
  const feedback = [];
  const requests = [];
  const blocks = [];

  const outcomeRepository = {
    async findByMeetingId(meetingId) {
      return outcomes.filter((row) => row.meetingId === meetingId);
    },
    async upsertOutcome(data) {
      const existing = outcomes.find(
        (row) =>
          row.meetingId === data.meetingId && row.respondentId === data.respondentId
      );
      if (existing) {
        Object.assign(existing, data);
        return existing;
      }
      const created = { id: `o-${outcomes.length + 1}`, ...data };
      outcomes.push(created);
      return created;
    },
  };

  const feedbackRepository = {
    async findByMeetingId(meetingId) {
      return feedback.filter((row) => row.meetingId === meetingId);
    },
    async findByMeetingAndSubmitter(meetingId, submittedBy) {
      return (
        feedback.find(
          (row) => row.meetingId === meetingId && row.submittedBy === submittedBy
        ) || null
      );
    },
    async createFeedback(data) {
      const created = { id: `f-${feedback.length + 1}`, createdAt: new Date(), ...data };
      feedback.push(created);
      return created;
    },
    async createFeedbackRequests(items) {
      for (const item of items) {
        requests.push({ id: `fr-${requests.length + 1}`, fulfilledAt: null, ...item });
      }
      return requests;
    },
    async markFeedbackRequestFulfilled(meetingId, recipientId) {
      const row = requests.find(
        (item) => item.meetingId === meetingId && item.recipientId === recipientId
      );
      if (row) row.fulfilledAt = new Date();
    },
    async findOutstandingFeedbackRequests() {
      return requests.filter((item) => !item.fulfilledAt);
    },
  };

  const blocklistRepository = {
    async findActive(menteeId, mentorId) {
      return (
        blocks.find(
          (block) =>
            block.menteeId === menteeId &&
            block.mentorId === mentorId &&
            !block.clearedAt
        ) || null
      );
    },
    async listActive() {
      return blocks.filter((block) => !block.clearedAt);
    },
    async createBlock(data) {
      const created = { id: `b-${blocks.length + 1}`, clearedAt: null, ...data };
      blocks.push(created);
      return created;
    },
    async clearBlock(blockId) {
      const block = blocks.find((item) => item.id === blockId);
      if (block) block.clearedAt = new Date();
      return block;
    },
  };

  return { outcomeRepository, feedbackRepository, blocklistRepository, blocks, requests };
}

describe("engagement API", () => {
  let app;
  let notifications;

  beforeEach(() => {
    const meeting = {
      id: MEETING_ID,
      menteeId: MENTEE_ID,
      mentorId: MENTOR_ID,
      retryAfterNoshowUsed: false,
    };
    const repos = createMemoryRepos();
    const meetingQueryPort = {
      async findById(id) {
        return id === MEETING_ID ? meeting : null;
      },
    };
    const meetingLifecyclePort = createRecordingMeetingLifecyclePort();
    const eventBus = new EventEmitter();
    notifications = [];
    const notificationService = {
      async send(notification) {
        notifications.push(notification);
      },
    };
    const blocklistService = createBlocklistService({
      blocklistRepository: repos.blocklistRepository,
    });
    const feedbackService = createFeedbackService({
      feedbackRepository: repos.feedbackRepository,
      meetingQueryPort,
      notificationService,
    });
    const outcomeService = createOutcomeService({
      outcomeRepository: repos.outcomeRepository,
      meetingQueryPort,
      meetingLifecyclePort,
      blocklistService,
      feedbackService,
      eventBus,
    });
    const authenticate = require("../middleware/auth").createAuthMiddleware(
      process.env.JWT_SECRET
    );
    const engagement = {
      router: createEngagementRouter({
        authenticate,
        outcomeService,
        feedbackService,
        blocklistService,
      }),
      outcomeService,
      feedbackService,
      blocklistService,
    };

    app = createApp({
      jwtSecret: process.env.JWT_SECRET,
      userRepository: { findPublicById: async () => null },
      notifications: {
        notificationRepository: { listForRecipient: async () => [] },
        realtimeHub: { subscribe() { return () => {}; }, publish() {} },
        notificationService,
      },
      engagement,
      meetingQueryPort,
      meetingLifecyclePort,
      feedbackRepository: repos.feedbackRepository,
    });
  });

  it("records arrival for a participant", async () => {
    const response = await request(app)
      .put(`/api/engagement/meetings/${MEETING_ID}/arrival`)
      .set("Authorization", `Bearer ${tokenFor(MENTEE_ID, ["mentee"])}`);

    expect(response.status).toBe(200);
    expect(response.body.recorded).toBe(true);
  });

  it("accepts outcome submissions and completes when both confirm", async () => {
    await request(app)
      .put(`/api/engagement/meetings/${MEETING_ID}/outcome`)
      .set("Authorization", `Bearer ${tokenFor(MENTEE_ID, ["mentee"])}`)
      .send({ happened: true })
      .expect(200);

    const response = await request(app)
      .put(`/api/engagement/meetings/${MEETING_ID}/outcome`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR_ID, ["mentor"])}`)
      .send({ happened: true });

    expect(response.status).toBe(200);
    expect(response.body.aggregation.status).toBe("completed");
    expect(notifications.some((item) => item.type === "feedback_request")).toBe(true);
  });

  it("accepts feedback once per participant", async () => {
    const first = await request(app)
      .post(`/api/engagement/meetings/${MEETING_ID}/feedback`)
      .set("Authorization", `Bearer ${tokenFor(MENTEE_ID, ["mentee"])}`)
      .send({ rating: 5, openText: "Great session" });

    expect(first.status).toBe(201);
    expect(first.body.rating).toBe(5);

    const second = await request(app)
      .post(`/api/engagement/meetings/${MEETING_ID}/feedback`)
      .set("Authorization", `Bearer ${tokenFor(MENTEE_ID, ["mentee"])}`)
      .send({ rating: 4, openText: "Again" });

    expect(second.status).toBe(409);
  });

  it("rejects unauthenticated engagement requests", async () => {
    const response = await request(app).put(
      `/api/engagement/meetings/${MEETING_ID}/arrival`
    );
    expect(response.status).toBe(401);
  });
});
