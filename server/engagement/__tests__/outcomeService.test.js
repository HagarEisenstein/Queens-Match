const { EventEmitter } = require("events");
const { createOutcomeService } = require("../outcomeService");
const { createFeedbackService } = require("../feedbackService");
const { createBlocklistService } = require("../blocklistService");
const {
  createRecordingMeetingLifecyclePort,
  LIFECYCLE_EVENTS,
} = require("../ports/meetingLifecyclePort");

function createMemoryOutcomeRepository() {
  const rows = [];
  return {
    rows,
    async findByMeetingId(meetingId) {
      return rows.filter((row) => row.meetingId === meetingId);
    },
    async findByMeetingAndRespondent(meetingId, respondentId) {
      return rows.find(
        (row) => row.meetingId === meetingId && row.respondentId === respondentId
      ) || null;
    },
    async upsertOutcome(data) {
      const existing = rows.find(
        (row) =>
          row.meetingId === data.meetingId && row.respondentId === data.respondentId
      );
      if (existing) {
        Object.assign(existing, data, { updatedAt: new Date() });
        return existing;
      }
      const created = { id: `o-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(created);
      return created;
    },
  };
}

function createMemoryFeedbackRepository() {
  const feedback = [];
  const requests = [];
  return {
    feedback,
    requests,
    async findByMeetingId(meetingId) {
      return feedback.filter((item) => item.meetingId === meetingId);
    },
    async findByMeetingAndSubmitter(meetingId, submittedBy) {
      return (
        feedback.find(
          (item) => item.meetingId === meetingId && item.submittedBy === submittedBy
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
        if (
          !requests.some(
            (row) =>
              row.meetingId === item.meetingId && row.recipientId === item.recipientId
          )
        ) {
          requests.push({
            id: `fr-${requests.length + 1}`,
            fulfilledAt: null,
            ...item,
          });
        }
      }
      return requests.filter((row) =>
        items.some(
          (item) =>
            item.meetingId === row.meetingId && item.recipientId === row.recipientId
        )
      );
    },
    async markFeedbackRequestFulfilled(meetingId, recipientId) {
      const row = requests.find(
        (item) => item.meetingId === meetingId && item.recipientId === recipientId
      );
      if (row) row.fulfilledAt = new Date();
    },
    async findPendingRequest(meetingId, recipientId) {
      return (
        requests.find(
          (item) =>
            item.meetingId === meetingId &&
            item.recipientId === recipientId &&
            !item.fulfilledAt
        ) || null
      );
    },
    async findOutstandingFeedbackRequests() {
      return requests.filter((item) => !item.fulfilledAt);
    },
  };
}

function createMemoryBlocklistRepository() {
  const blocks = [];
  return {
    blocks,
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
      const existing = await this.findActive(data.menteeId, data.mentorId);
      if (existing) return existing;
      const created = { id: `b-${blocks.length + 1}`, clearedAt: null, ...data };
      blocks.push(created);
      return created;
    },
    async clearBlock(blockId) {
      const block = blocks.find((item) => item.id === blockId);
      if (!block) return null;
      block.clearedAt = new Date();
      return block;
    },
  };
}

describe("outcomeService (in-memory)", () => {
  const meeting = {
    id: "11111111-1111-1111-1111-111111111111",
    menteeId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    mentorId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    retryAfterNoshowUsed: false,
  };

  function build() {
    const eventBus = new EventEmitter();
    const notifications = [];
    const outcomeRepository = createMemoryOutcomeRepository();
    const feedbackRepository = createMemoryFeedbackRepository();
    const blocklistRepository = createMemoryBlocklistRepository();
    const meetingLifecyclePort = createRecordingMeetingLifecyclePort();
    const meetingQueryPort = {
      async findById(id) {
        return id === meeting.id ? meeting : null;
      },
    };
    const blocklistService = createBlocklistService({ blocklistRepository });
    const feedbackService = createFeedbackService({
      feedbackRepository,
      meetingQueryPort,
      notificationService: {
        async send(notification) {
          notifications.push(notification);
        },
      },
    });
    const outcomeService = createOutcomeService({
      outcomeRepository,
      meetingQueryPort,
      meetingLifecyclePort,
      blocklistService,
      feedbackService,
      eventBus,
    });

    return {
      outcomeService,
      feedbackService,
      blocklistService,
      meetingLifecyclePort,
      feedbackRepository,
      blocklistRepository,
      notifications,
      eventBus,
    };
  }

  it("awaits the second response before aggregating to completed", async () => {
    const { outcomeService, feedbackRepository, notifications, meetingLifecyclePort } =
      build();

    const menteeResult = await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.menteeId, roles: ["mentee"] },
      { happened: true }
    );
    expect(menteeResult.aggregation.status).toBe("awaiting_responses");
    expect(feedbackRepository.requests).toHaveLength(0);

    const mentorResult = await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.mentorId, roles: ["mentor"] },
      { happened: true }
    );
    expect(mentorResult.aggregation.status).toBe("completed");
    expect(feedbackRepository.requests).toHaveLength(2);
    expect(notifications).toHaveLength(2);
    expect(
      meetingLifecyclePort.events.some(
        (event) => event.eventName === LIFECYCLE_EVENTS.MEETING_COMPLETED
      )
    ).toBe(true);
  });

  it("blocks the mentor when mentee reports mentor ghosting", async () => {
    const { outcomeService, blocklistRepository } = build();

    await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.menteeId, roles: ["mentee"] },
      { happened: false, absentParty: "other", stillWantToMeet: false }
    );
    await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.mentorId, roles: ["mentor"] },
      { happened: false, absentParty: "unclear", stillWantToMeet: false }
    );

    expect(blocklistRepository.blocks).toHaveLength(1);
    expect(blocklistRepository.blocks[0]).toMatchObject({
      menteeId: meeting.menteeId,
      mentorId: meeting.mentorId,
      reason: "mentor_ghosted",
    });
  });

  it("does not block a mentor while conflicting reports require admin review", async () => {
    const { outcomeService, blocklistRepository } = build();

    await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.menteeId, roles: ["mentee"] },
      { happened: false, absentParty: "other", stillWantToMeet: false }
    );
    const result = await outcomeService.submitOutcome(
      meeting.id,
      { id: meeting.mentorId, roles: ["mentor"] },
      { happened: true }
    );

    expect(result.aggregation.status).toBe("admin_review");
    expect(blocklistRepository.blocks).toHaveLength(0);
  });

  it("rejects feedback before a completed outcome creates a request", async () => {
    const { feedbackService } = build();

    await expect(
      feedbackService.submitFeedback(
        meeting.id,
        { id: meeting.menteeId, roles: ["mentee"] },
        { rating: 5, openText: "Too early" }
      )
    ).rejects.toMatchObject({ code: "FEEDBACK_NOT_AVAILABLE" });
  });

  it("records arrival through the lifecycle port", async () => {
    const { outcomeService, meetingLifecyclePort } = build();
    const result = await outcomeService.recordArrival(meeting.id, {
      id: meeting.menteeId,
      roles: ["mentee"],
    });

    expect(result.recorded).toBe(true);
    expect(meetingLifecyclePort.events[0].eventName).toBe(
      LIFECYCLE_EVENTS.ARRIVAL_RECORDED
    );
  });
});
