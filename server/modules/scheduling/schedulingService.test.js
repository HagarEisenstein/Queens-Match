jest.mock("../../commons/db", () => ({
  user: { findUnique: jest.fn() },
  meeting: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  meetingTimeSlot: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock("../../commons/eventBus", () => ({ emit: jest.fn() }));

const prisma = require("../../commons/db");
const eventBus = require("../../commons/eventBus");
const {
  requestMeeting,
  offerTimes,
  rejectMeeting,
  selectTime,
  requestMoreTimes,
  declineOfferedTimes,
  flagCantMakeIt,
  reopenAfterNoShow,
  getMeetingById,
} = require("./schedulingService");
const { MEETING_STATUS } = require("./meetingStateMachine");

const MENTEE = "11111111-1111-1111-1111-111111111111";
const MENTOR = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";
const MEETING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function futureSlot(hoursFromNow, id = "slot-1") {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { id, startTime: start, endTime: end };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Run transaction callbacks against the same mock client.
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
});

describe("requestMeeting", () => {
  it("creates a pending meeting and emits MeetingRequested", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: MENTOR, roles: ["mentor"] });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.create.mockResolvedValue({ id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR });

    const result = await requestMeeting({ menteeId: MENTEE, mentorId: MENTOR });

    expect(prisma.meeting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { menteeId: MENTEE, mentorId: MENTOR, status: MEETING_STATUS.PENDING_MENTOR_TIMES },
      })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingRequested", {
      meetingId: MEETING_ID,
      mentorId: MENTOR,
      menteeId: MENTEE,
    });
    expect(result.id).toBe(MEETING_ID);
  });

  it("rejects requesting a meeting with yourself", async () => {
    await expect(requestMeeting({ menteeId: MENTEE, mentorId: MENTEE })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(prisma.meeting.create).not.toHaveBeenCalled();
  });

  it("404s when the target is not a mentor", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: MENTOR, roles: ["mentee"] });

    await expect(requestMeeting({ menteeId: MENTEE, mentorId: MENTOR })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it("409s when an active meeting with the mentor already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: MENTOR, roles: ["mentor"] });
    prisma.meeting.findFirst.mockResolvedValue({ id: "existing" });

    await expect(requestMeeting({ menteeId: MENTEE, mentorId: MENTOR })).rejects.toMatchObject({
      statusCode: 409,
      code: "MEETING_ALREADY_ACTIVE",
    });
    expect(prisma.meeting.create).not.toHaveBeenCalled();
  });

  it("409s when the database rejects a concurrent active meeting", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: MENTOR, roles: ["mentor"] });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.create.mockRejectedValue({ code: "P2002" });

    await expect(requestMeeting({ menteeId: MENTEE, mentorId: MENTOR })).rejects.toMatchObject({
      statusCode: 409,
      code: "MEETING_ALREADY_ACTIVE",
    });
    expect(eventBus.emit).not.toHaveBeenCalled();
  });
});

describe("offerTimes", () => {
  it("replaces slots, advances status and emits TimesOffered", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID,
      menteeId: MENTEE,
      mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES,
      timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.PENDING_MENTEE_SELECTION });

    const slots = [
      { startTime: new Date(Date.now() + 3600_000).toISOString(), endTime: new Date(Date.now() + 5400_000).toISOString() },
    ];
    await offerTimes({ meetingId: MEETING_ID, actorId: MENTOR, slots });

    expect(prisma.meetingTimeSlot.deleteMany).toHaveBeenCalledWith({ where: { meetingId: MEETING_ID } });
    expect(prisma.meetingTimeSlot.createMany).toHaveBeenCalled();
    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: MEETING_STATUS.PENDING_MENTEE_SELECTION } })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("TimesOffered", {
      meetingId: MEETING_ID,
      menteeId: MENTEE,
      offeredAt: expect.any(String),
    });
  });

  it("forbids a non-mentor from offering times", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES, timeSlots: [],
    });

    await expect(
      offerTimes({ meetingId: MEETING_ID, actorId: OTHER, slots: [futureSlot(1)] })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it("refuses to offer times on an already scheduled meeting (illegal transition)", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.SCHEDULED, timeSlots: [],
    });

    const slots = [
      { startTime: new Date(Date.now() + 3600_000).toISOString(), endTime: new Date(Date.now() + 5400_000).toISOString() },
    ];
    await expect(offerTimes({ meetingId: MEETING_ID, actorId: MENTOR, slots })).rejects.toMatchObject({
      statusCode: 409,
      code: "ILLEGAL_TRANSITION",
    });
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it("rejects offered times that are in the past", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES, timeSlots: [],
    });

    const slots = [
      { startTime: new Date(Date.now() - 3600_000).toISOString(), endTime: new Date(Date.now() - 1800_000).toISOString() },
    ];
    await expect(offerTimes({ meetingId: MEETING_ID, actorId: MENTOR, slots })).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_SLOTS",
    });
  });
});

describe("rejectMeeting", () => {
  it("moves a pending meeting to rejected and emits MeetingRejected", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.REJECTED });

    await rejectMeeting({ meetingId: MEETING_ID, actorId: MENTOR });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: MEETING_STATUS.REJECTED } })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingRejected", { meetingId: MEETING_ID, menteeId: MENTEE });
  });
});

describe("requestMoreTimes", () => {
  it("sends the meeting back to awaiting mentor times, spends the flag once, and notifies the mentor", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, moreTimesUsed: false, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.PENDING_MENTOR_TIMES });

    await requestMoreTimes({ meetingId: MEETING_ID, actorId: MENTEE });

    expect(prisma.meetingTimeSlot.deleteMany).toHaveBeenCalledWith({ where: { meetingId: MEETING_ID } });
    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MEETING_STATUS.PENDING_MENTOR_TIMES, scheduledTime: null, moreTimesUsed: true },
      })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MoreTimesRequested", { meetingId: MEETING_ID, mentorId: MENTOR });
  });

  it("forbids the mentor from requesting more times", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, moreTimesUsed: false, timeSlots: [],
    });

    await expect(
      requestMoreTimes({ meetingId: MEETING_ID, actorId: MENTOR })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });

  it("blocks a second request once the one retry is already spent", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, moreTimesUsed: true, timeSlots: [],
    });

    await expect(
      requestMoreTimes({ meetingId: MEETING_ID, actorId: MENTEE })
    ).rejects.toMatchObject({ statusCode: 409, code: "RETRY_ALREADY_USED" });
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });
});

describe("declineOfferedTimes", () => {
  it("moves the meeting to rejected and notifies the mentor", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.REJECTED });

    await declineOfferedTimes({ meetingId: MEETING_ID, actorId: MENTEE });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: MEETING_STATUS.REJECTED } })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingDeclinedByMentee", { meetingId: MEETING_ID, mentorId: MENTOR });
  });

  it("forbids the mentor from declining on the mentee's behalf", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, timeSlots: [],
    });

    await expect(
      declineOfferedTimes({ meetingId: MEETING_ID, actorId: MENTOR })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("flagCantMakeIt", () => {
  it("reschedules a scheduled meeting the first time, spends the flag, and notifies the other side", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.SCHEDULED, rescheduleUsed: false, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.PENDING_MENTOR_TIMES });

    await flagCantMakeIt({ meetingId: MEETING_ID, actorId: MENTOR });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MEETING_STATUS.PENDING_MENTOR_TIMES, scheduledTime: null, rescheduleUsed: true },
      })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingRescheduleRequested", {
      meetingId: MEETING_ID,
      recipientId: MENTEE,
    });
  });

  it("cancels a scheduled meeting on a second can't-make-it and notifies both sides", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.SCHEDULED, rescheduleUsed: true, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.CANCELLED });

    await flagCantMakeIt({ meetingId: MEETING_ID, actorId: MENTEE });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: MEETING_STATUS.CANCELLED, scheduledTime: null } })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingCancelled", {
      meetingId: MEETING_ID,
      mentorId: MENTOR,
      menteeId: MENTEE,
    });
  });

  it("forbids a non-participant from flagging can't-make-it", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.SCHEDULED, rescheduleUsed: false, timeSlots: [],
    });

    await expect(
      flagCantMakeIt({ meetingId: MEETING_ID, actorId: OTHER })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("refuses to flag can't-make-it before the meeting is scheduled (illegal transition)", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES, rescheduleUsed: false, timeSlots: [],
    });

    await expect(
      flagCantMakeIt({ meetingId: MEETING_ID, actorId: MENTOR })
    ).rejects.toMatchObject({ statusCode: 409, code: "ILLEGAL_TRANSITION" });
  });
});

describe("reopenAfterNoShow", () => {
  it("reopens a scheduled meeting, spends the no-show retry flag, and notifies both sides", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.SCHEDULED, retryAfterNoshowUsed: false, timeSlots: [],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.PENDING_MENTOR_TIMES });

    await reopenAfterNoShow({ meetingId: MEETING_ID });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MEETING_STATUS.PENDING_MENTOR_TIMES, scheduledTime: null, retryAfterNoshowUsed: true },
      })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingReopenedAfterNoShow", {
      meetingId: MEETING_ID,
      mentorId: MENTOR,
      menteeId: MENTEE,
    });
  });
});

describe("selectTime", () => {
  it("schedules the meeting on the chosen slot and emits MeetingMatched", async () => {
    const slot = futureSlot(48, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, timeSlots: [slot],
    });
    prisma.meeting.update.mockResolvedValue({ id: MEETING_ID, status: MEETING_STATUS.SCHEDULED });

    await selectTime({ meetingId: MEETING_ID, actorId: MENTEE, slotId: slot.id });

    expect(prisma.meeting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: MEETING_STATUS.SCHEDULED, scheduledTime: slot.startTime },
      })
    );
    expect(eventBus.emit).toHaveBeenCalledWith("MeetingMatched", {
      meetingId: MEETING_ID,
      mentorId: MENTOR,
      scheduledTime: slot.startTime,
    });
  });

  it("forbids the mentor from selecting on the mentee's behalf", async () => {
    const slot = futureSlot(48);
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, timeSlots: [slot],
    });

    await expect(
      selectTime({ meetingId: MEETING_ID, actorId: MENTOR, slotId: slot.id })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a slot id that was never offered", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTEE_SELECTION, timeSlots: [futureSlot(48, "real-slot")],
    });

    await expect(
      selectTime({ meetingId: MEETING_ID, actorId: MENTEE, slotId: "ghost-slot" })
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_SLOT" });
  });

  it("refuses to select before any times were offered (illegal transition)", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR,
      status: MEETING_STATUS.PENDING_MENTOR_TIMES,
      timeSlots: [futureSlot(48, "slot-x")],
    });

    await expect(
      selectTime({ meetingId: MEETING_ID, actorId: MENTEE, slotId: "slot-x" })
    ).rejects.toMatchObject({ statusCode: 409, code: "ILLEGAL_TRANSITION" });
    expect(prisma.meeting.update).not.toHaveBeenCalled();
  });
});

describe("getMeetingById", () => {
  it("returns the meeting for a participant", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR, timeSlots: [],
    });

    const result = await getMeetingById(MEETING_ID, MENTEE);
    expect(result.id).toBe(MEETING_ID);
  });

  it("forbids a non-participant", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID, menteeId: MENTEE, mentorId: MENTOR, timeSlots: [],
    });

    await expect(getMeetingById(MEETING_ID, OTHER)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("404s for a missing meeting", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);

    await expect(getMeetingById(MEETING_ID, MENTEE)).rejects.toMatchObject({ statusCode: 404 });
  });
});
