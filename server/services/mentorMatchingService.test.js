const {
  rankMentorsByEngagement,
} = require("./mentorMatchingService");

const selectedTopics = [
  "CV / Resume Review",
  "System Design Interviews",
  "Technical Mock Interviews",
];

function createPrismaMock({ meetings = [], outcomes = [], feedbacks = [] } = {}) {
  return {
    meeting: { findMany: jest.fn().mockResolvedValue(meetings) },
    meetingOutcomeResponse: {
      findMany: jest.fn().mockResolvedValue(outcomes),
    },
    feedback: { findMany: jest.fn().mockResolvedValue(feedbacks) },
  };
}

const mentorA = {
  id: "profile-a",
  userId: "mentor-a",
  meetingsOffered: 2,
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};
const mentorB = {
  id: "profile-b",
  userId: "mentor-b",
  meetingsOffered: 2,
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
};

describe("mentorMatchingService", () => {
  it("ranks mentors by matching-topic count before engagement", async () => {
    const threeTopicMentor = {
      ...mentorA,
      adviceTopics: selectedTopics,
    };
    const twoTopicMentor = {
      ...mentorB,
      adviceTopics: selectedTopics.slice(0, 2),
    };
    const oneTopicMentor = {
      id: "profile-c",
      userId: "mentor-c",
      meetingsOffered: 2,
      updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      adviceTopics: selectedTopics.slice(0, 1),
    };
    const prismaClient = createPrismaMock({
      meetings: [
        {
          id: "meeting-b",
          mentorId: "mentor-b",
          menteeId: "mentee-b",
          status: "scheduled",
          scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          id: "meeting-c",
          mentorId: "mentor-c",
          menteeId: "mentee-c",
          status: "scheduled",
          scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
      outcomes: [
        { meetingId: "meeting-b", role: "mentee", happened: true },
        { meetingId: "meeting-b", role: "mentor", happened: true },
        { meetingId: "meeting-c", role: "mentee", happened: true },
        { meetingId: "meeting-c", role: "mentor", happened: true },
      ],
      feedbacks: [
        { meetingId: "meeting-b", submittedBy: "mentee-b", rating: 5 },
        { meetingId: "meeting-c", submittedBy: "mentee-c", rating: 5 },
      ],
    });

    const ranked = await rankMentorsByEngagement(
      [oneTopicMentor, twoTopicMentor, threeTopicMentor],
      {
        prismaClient,
        adviceTopics: selectedTopics,
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      }
    );

    expect(ranked).toEqual([
      threeTopicMentor,
      twoTopicMentor,
      oneTopicMentor,
    ]);
  });

  it("uses engagement to break ties between equal topic matches", async () => {
    const lowerEngagementMentor = {
      ...mentorA,
      adviceTopics: selectedTopics.slice(0, 2),
    };
    const higherEngagementMentor = {
      ...mentorB,
      adviceTopics: selectedTopics.slice(1),
    };
    const prismaClient = createPrismaMock({
      meetings: [
        {
          id: "meeting-a",
          mentorId: "mentor-a",
          menteeId: "mentee-a",
          status: "scheduled",
          scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          id: "meeting-b",
          mentorId: "mentor-b",
          menteeId: "mentee-b",
          status: "scheduled",
          scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
        },
      ],
      outcomes: [
        {
          meetingId: "meeting-a",
          role: "mentee",
          happened: false,
          absentParty: "other",
          stillWantToMeet: false,
        },
        {
          meetingId: "meeting-a",
          role: "mentor",
          happened: false,
          absentParty: "self",
          stillWantToMeet: false,
        },
        { meetingId: "meeting-b", role: "mentee", happened: true },
        { meetingId: "meeting-b", role: "mentor", happened: true },
      ],
      feedbacks: [
        { meetingId: "meeting-b", submittedBy: "mentee-b", rating: 5 },
      ],
    });

    const ranked = await rankMentorsByEngagement(
      [lowerEngagementMentor, higherEngagementMentor],
      {
        prismaClient,
        adviceTopics: selectedTopics,
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      }
    );

    expect(ranked).toEqual([higherEngagementMentor, lowerEngagementMentor]);
  });

  it("ranks topic relevance even when mentors have no engagement history", async () => {
    const threeTopicMentor = { ...mentorA, adviceTopics: selectedTopics };
    const oneTopicMentor = {
      ...mentorB,
      adviceTopics: selectedTopics.slice(0, 1),
    };
    const prismaClient = createPrismaMock();

    const ranked = await rankMentorsByEngagement(
      [oneTopicMentor, threeTopicMentor],
      { prismaClient, adviceTopics: selectedTopics }
    );

    expect(ranked).toEqual([threeTopicMentor, oneTopicMentor]);
  });

  it("uses a fixed number of batch queries and ranks engagement without exposing scores", async () => {
    const prismaClient = createPrismaMock({
      meetings: [
        {
          id: "meeting-a",
          mentorId: "mentor-a",
          menteeId: "mentee-a",
          status: "scheduled",
          scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
        },
        {
          id: "meeting-b",
          mentorId: "mentor-b",
          menteeId: "mentee-b",
          status: "pending_mentor_times",
          scheduledTime: null,
        },
      ],
      outcomes: [
        { meetingId: "meeting-a", role: "mentee", happened: true },
        { meetingId: "meeting-a", role: "mentor", happened: true },
        {
          meetingId: "meeting-b",
          role: "mentee",
          happened: false,
          absentParty: "other",
          stillWantToMeet: false,
        },
        {
          meetingId: "meeting-b",
          role: "mentor",
          happened: false,
          absentParty: "self",
          stillWantToMeet: false,
        },
      ],
      feedbacks: [
        { meetingId: "meeting-a", submittedBy: "mentee-a", rating: 5 },
      ],
    });

    const ranked = await rankMentorsByEngagement([mentorB, mentorA], {
      prismaClient,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(ranked).toEqual([mentorA, mentorB]);
    expect(ranked.every((mentor) => !("score" in mentor))).toBe(true);
    expect(prismaClient.meeting.findMany).toHaveBeenCalledTimes(1);
    expect(prismaClient.meetingOutcomeResponse.findMany).toHaveBeenCalledTimes(1);
    expect(prismaClient.feedback.findMany).toHaveBeenCalledTimes(1);
  });

  it("ignores mentor-authored feedback when evaluating mentor quality", async () => {
    const meetings = [
      {
        id: "meeting-a",
        mentorId: "mentor-a",
        menteeId: "mentee-a",
        status: "scheduled",
        scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "meeting-b",
        mentorId: "mentor-b",
        menteeId: "mentee-b",
        status: "scheduled",
        scheduledTime: new Date("2026-07-01T00:00:00.000Z"),
      },
    ];
    const outcomes = meetings.flatMap((meeting) => [
      { meetingId: meeting.id, role: "mentee", happened: true },
      { meetingId: meeting.id, role: "mentor", happened: true },
    ]);
    const prismaClient = createPrismaMock({
      meetings,
      outcomes,
      feedbacks: [
        { meetingId: "meeting-a", submittedBy: "mentor-a", rating: 5 },
        { meetingId: "meeting-b", submittedBy: "mentee-b", rating: 4 },
      ],
    });

    const ranked = await rankMentorsByEngagement([mentorA, mentorB], {
      prismaClient,
      now: () => new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(ranked).toEqual([mentorB, mentorA]);
  });

  it("skips outcome and feedback reads when filtered mentors have no meetings", async () => {
    const prismaClient = createPrismaMock();

    const ranked = await rankMentorsByEngagement([mentorA, mentorB], {
      prismaClient,
    });

    expect(ranked).toEqual([mentorA, mentorB]);
    expect(prismaClient.meetingOutcomeResponse.findMany).not.toHaveBeenCalled();
    expect(prismaClient.feedback.findMany).not.toHaveBeenCalled();
  });

  it("treats pending and future scheduled meetings as load but ignores past meetings", async () => {
    const olderAvailableMentor = {
      ...mentorA,
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    };
    const newerBusyMentor = {
      ...mentorB,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    };
    const prismaClient = createPrismaMock({
      meetings: [
        {
          id: "past",
          mentorId: "mentor-a",
          menteeId: "mentee-a",
          status: "scheduled",
          scheduledTime: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "pending",
          mentorId: "mentor-b",
          menteeId: "mentee-b",
          status: "pending_mentee_selection",
          scheduledTime: null,
        },
        {
          id: "future",
          mentorId: "mentor-b",
          menteeId: "mentee-c",
          status: "scheduled",
          scheduledTime: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    });

    const ranked = await rankMentorsByEngagement(
      [newerBusyMentor, olderAvailableMentor],
      {
        prismaClient,
        now: () => new Date("2026-09-01T00:00:00.000Z"),
      }
    );

    expect(ranked).toEqual([olderAvailableMentor, newerBusyMentor]);
  });

  it("does no history work when there is nothing to rank", async () => {
    const prismaClient = createPrismaMock();

    await expect(
      rankMentorsByEngagement([mentorA], { prismaClient })
    ).resolves.toEqual([mentorA]);
    expect(prismaClient.meeting.findMany).not.toHaveBeenCalled();
  });
});
