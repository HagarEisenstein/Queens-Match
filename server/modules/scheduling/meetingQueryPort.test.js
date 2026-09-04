jest.mock("../../commons/db", () => ({
  meeting: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  meetingOutcomeResponse: {
    groupBy: jest.fn(),
  },
}));

const prisma = require("../../commons/db");
const { createSchedulingMeetingQueryPort } = require("./meetingQueryPort");
const { MEETING_STATUS } = require("./meetingStateMachine");

const MEETING_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MEETING_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeEach(() => jest.clearAllMocks());

describe("createSchedulingMeetingQueryPort", () => {
  it("findById returns the fields engagement/comms need, including the retry flags", async () => {
    prisma.meeting.findUnique.mockResolvedValue({ id: MEETING_A, status: MEETING_STATUS.SCHEDULED });

    const port = createSchedulingMeetingQueryPort();
    const result = await port.findById(MEETING_A);

    expect(prisma.meeting.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEETING_A },
        select: expect.objectContaining({
          status: true,
          moreTimesUsed: true,
          rescheduleUsed: true,
          retryAfterNoshowUsed: true,
        }),
      })
    );
    expect(result).toEqual({ id: MEETING_A, status: MEETING_STATUS.SCHEDULED });
  });

  it("findScheduledMeetingsBetween queries scheduled meetings in the given window", async () => {
    prisma.meeting.findMany.mockResolvedValue([{ id: MEETING_A }]);
    const scheduledFrom = new Date("2026-10-01T00:00:00.000Z");
    const scheduledUntil = new Date("2026-10-01T01:00:00.000Z");

    const port = createSchedulingMeetingQueryPort();
    const result = await port.findScheduledMeetingsBetween({ scheduledFrom, scheduledUntil });

    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: MEETING_STATUS.SCHEDULED,
          scheduledTime: { gte: scheduledFrom, lte: scheduledUntil },
        },
      })
    );
    expect(result).toEqual([{ id: MEETING_A }]);
  });

  it("findMeetingsAwaitingOutcome excludes meetings both sides already answered", async () => {
    prisma.meeting.findMany.mockResolvedValue([
      { id: MEETING_A, menteeId: "m1", mentorId: "m2" },
      { id: MEETING_B, menteeId: "m3", mentorId: "m4" },
    ]);
    prisma.meetingOutcomeResponse.groupBy.mockResolvedValue([
      { meetingId: MEETING_A, _count: { _all: 2 } },
      { meetingId: MEETING_B, _count: { _all: 1 } },
    ]);

    const port = createSchedulingMeetingQueryPort();
    const result = await port.findMeetingsAwaitingOutcome({ before: new Date() });

    expect(result).toEqual([{ id: MEETING_B, menteeId: "m3", mentorId: "m4" }]);
  });

  it("findMeetingsAwaitingOutcome short-circuits when there are no candidate meetings", async () => {
    prisma.meeting.findMany.mockResolvedValue([]);

    const port = createSchedulingMeetingQueryPort();
    const result = await port.findMeetingsAwaitingOutcome({ before: new Date() });

    expect(result).toEqual([]);
    expect(prisma.meetingOutcomeResponse.groupBy).not.toHaveBeenCalled();
  });
});
