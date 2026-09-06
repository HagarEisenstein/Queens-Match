const {
  rankMentorsByEngagement,
} = require("./mentorMatchingService");

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
