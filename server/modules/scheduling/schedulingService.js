const prisma = require("../../commons/db");
const eventBus = require("../../commons/eventBus");
const {
  MEETING_STATUS,
  MEETING_ACTION,
  INITIAL_STATUS,
  transition,
} = require("./meetingStateMachine");

/**
 * The scheduling service is the only thing that writes to a meeting. Every
 * mutation runs the pure state machine first, so an illegal move fails before
 * a single row is touched, then emits the matching domain event on the shared
 * event bus. The `comms` module (Epic 5) already listens for exactly these
 * event names and payloads — this service is the producer side of that seam.
 */

const meetingInclude = {
  timeSlots: { orderBy: { startTime: "asc" } },
  mentee: { select: participantSelect() },
  mentor: { select: participantSelect() },
};

function participantSelect() {
  return {
    id: true,
    username: true,
    fullName: true,
    photoUrl: true,
  };
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertParticipant(meeting, userId) {
  if (meeting.menteeId !== userId && meeting.mentorId !== userId) {
    throw httpError(403, "FORBIDDEN", "You are not a participant in this meeting.");
  }
}

async function loadMeetingOr404(meetingId) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });
  if (!meeting) {
    throw httpError(404, "NOT_FOUND", "Meeting not found.");
  }
  return meeting;
}

/**
 * Mentee expresses interest with one click [R4.2]. A new meeting is born in
 * `pending_mentor_times`. We refuse a second live request to the same mentor so
 * a mentee cannot spam duplicate threads.
 */
async function requestMeeting({ menteeId, mentorId }) {
  if (menteeId === mentorId) {
    throw httpError(400, "INVALID_REQUEST", "You cannot request a meeting with yourself.");
  }

  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    select: { id: true, roles: true },
  });
  if (!mentor || !mentor.roles.includes("mentor")) {
    throw httpError(404, "NOT_FOUND", "Mentor not found.");
  }

  const existing = await prisma.meeting.findFirst({
    where: {
      menteeId,
      mentorId,
      status: {
        in: [
          MEETING_STATUS.PENDING_MENTOR_TIMES,
          MEETING_STATUS.PENDING_MENTEE_SELECTION,
          MEETING_STATUS.SCHEDULED,
        ],
      },
    },
    select: { id: true },
  });
  if (existing) {
    throw httpError(
      409,
      "MEETING_ALREADY_ACTIVE",
      "You already have an active meeting with this mentor."
    );
  }

  let meeting;
  try {
    meeting = await prisma.meeting.create({
      data: { menteeId, mentorId, status: INITIAL_STATUS },
      include: meetingInclude,
    });
  } catch (error) {
    // The partial unique index is the final guard against concurrent requests.
    if (error.code === "P2002") {
      throw httpError(
        409,
        "MEETING_ALREADY_ACTIVE",
        "You already have an active meeting with this mentor."
      );
    }
    throw error;
  }

  eventBus.emit("MeetingRequested", {
    meetingId: meeting.id,
    mentorId,
    menteeId,
  });

  return meeting;
}

/**
 * Mentor marks available times in a calendar UI [R4.3] →
 * `pending_mentee_selection`. Only the owning mentor may offer, and the offered
 * set fully replaces any previous set (this is also the seam Epic 4 reuses when
 * more times are requested).
 */
async function offerTimes({ meetingId, actorId, slots }) {
  const meeting = await loadMeetingOr404(meetingId);
  if (meeting.mentorId !== actorId) {
    throw httpError(403, "FORBIDDEN", "Only the mentor can offer times for this meeting.");
  }

  const nextStatus = transition(meeting.status, MEETING_ACTION.OFFER_TIMES);
  const normalizedSlots = normalizeSlots(slots);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingTimeSlot.deleteMany({ where: { meetingId } });
    await tx.meetingTimeSlot.createMany({
      data: normalizedSlots.map((slot) => ({ meetingId, ...slot })),
    });
    return tx.meeting.update({
      where: { id: meetingId },
      data: { status: nextStatus },
      include: meetingInclude,
    });
  });

  eventBus.emit("TimesOffered", {
    meetingId,
    menteeId: meeting.menteeId,
  });

  return updated;
}

/**
 * Mentor rejects the request [R4.3] → `rejected`. The mentee is notified by the
 * comms module and no longer owes anyone anything; they may start over [R4.4].
 */
async function rejectMeeting({ meetingId, actorId }) {
  const meeting = await loadMeetingOr404(meetingId);
  if (meeting.mentorId !== actorId) {
    throw httpError(403, "FORBIDDEN", "Only the mentor can reject this meeting.");
  }

  const nextStatus = transition(meeting.status, MEETING_ACTION.REJECT);

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: nextStatus },
    include: meetingInclude,
  });

  eventBus.emit("MeetingRejected", {
    meetingId,
    menteeId: meeting.menteeId,
  });

  return updated;
}

/**
 * Mentee picks exactly one offered time [R4.4] → `scheduled`; the mentor is
 * notified of the match [R4.5]. No multi-select: exactly one slot id.
 */
async function selectTime({ meetingId, actorId, slotId }) {
  const meeting = await loadMeetingOr404(meetingId);
  if (meeting.menteeId !== actorId) {
    throw httpError(403, "FORBIDDEN", "Only the mentee can pick a time for this meeting.");
  }

  const slot = meeting.timeSlots.find((candidate) => candidate.id === slotId);
  if (!slot) {
    throw httpError(400, "INVALID_SLOT", "That time is not one of the offered options.");
  }

  const nextStatus = transition(meeting.status, MEETING_ACTION.SELECT_TIME);

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: nextStatus, scheduledTime: slot.startTime },
    include: meetingInclude,
  });
  if (typeof prisma.meetingTimeSlot.update === "function") {
    await prisma.meetingTimeSlot.update({ where: { id: slot.id }, data: { isBooked: true } });
  }

  eventBus.emit("MeetingMatched", {
    meetingId,
    mentorId: meeting.mentorId,
    scheduledTime: slot.startTime,
  });

  return updated;
}

async function requestMoreTimes({ meetingId, actorId }) {
  const meeting = await loadMeetingOr404(meetingId);
  if (meeting.menteeId !== actorId) throw httpError(403, "FORBIDDEN", "Only the mentee can request more times.");
  if (meeting.moreTimesUsed) throw httpError(409, "RETRY_EXHAUSTED", "Additional times were already requested for this meeting.");
  const nextStatus = transition(meeting.status, MEETING_ACTION.REQUEST_MORE_TIMES);
  return prisma.meeting.update({ where: { id: meetingId }, data: { status: nextStatus, moreTimesUsed: true }, include: meetingInclude });
}

async function reportCannotAttend({ meetingId, actorId }) {
  const meeting = await loadMeetingOr404(meetingId);
  assertParticipant(meeting, actorId);
  const action = meeting.rescheduleUsed ? `${MEETING_ACTION.CANNOT_ATTEND}_AGAIN` : MEETING_ACTION.CANNOT_ATTEND;
  const nextStatus = transition(meeting.status, action);
  await prisma.meetingTimeSlot.updateMany({ where: { meetingId, isBooked: true }, data: { isBooked: false } });
  return prisma.meeting.update({ where: { id: meetingId }, data: { status: nextStatus, scheduledTime: null, rescheduleUsed: true }, include: meetingInclude });
}

async function confirmArrival({ meetingId, actorId }) {
  const meeting = await loadMeetingOr404(meetingId);
  assertParticipant(meeting, actorId);
  const data = meeting.menteeId === actorId
    ? { menteeArrivalConfirmed: true }
    : { mentorArrivalConfirmed: true };
  const bothConfirmed = (meeting.menteeArrivalConfirmed || data.menteeArrivalConfirmed) &&
    (meeting.mentorArrivalConfirmed || data.mentorArrivalConfirmed);
  return prisma.meeting.update({
    where: { id: meetingId },
    data: { ...data, ...(bothConfirmed ? { status: transition(meeting.status, MEETING_ACTION.CONFIRM_ARRIVAL) } : {}) },
    include: meetingInclude,
  });
}

async function getMeetingById(meetingId, requesterId) {
  const meeting = await loadMeetingOr404(meetingId);
  assertParticipant(meeting, requesterId);
  return meeting;
}

/** Every meeting a user is part of, on either side. */
async function listMeetingsForUser(userId) {
  return prisma.meeting.findMany({
    where: { OR: [{ menteeId: userId }, { mentorId: userId }] },
    include: meetingInclude,
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Coerce API slot input into DB rows: each slot must have a start strictly
 * before its end, and starts must be in the future.
 */
function normalizeSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw httpError(400, "INVALID_SLOTS", "Offer at least one time slot.");
  }

  const now = Date.now();
  return slots.map(({ startTime, endTime }) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw httpError(400, "INVALID_SLOTS", "Each slot needs a valid start and end time.");
    }
    if (start.getTime() >= end.getTime()) {
      throw httpError(400, "INVALID_SLOTS", "A slot must start before it ends.");
    }
    if (start.getTime() <= now) {
      throw httpError(400, "INVALID_SLOTS", "Offered times must be in the future.");
    }
    return { startTime: start, endTime: end };
  });
}

module.exports = {
  requestMeeting,
  offerTimes,
  rejectMeeting,
  selectTime,
  requestMoreTimes,
  reportCannotAttend,
  confirmArrival,
  getMeetingById,
  listMeetingsForUser,
};
