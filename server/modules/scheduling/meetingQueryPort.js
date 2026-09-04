const prisma = require("../../commons/db");
const { MEETING_STATUS } = require("./meetingStateMachine");

/**
 * The real implementation of engagement's `meetingQueryPort` and comms'
 * `meetingRepository` — both just read meeting data owned by this module.
 * Without this, engagement's outcome/feedback flow 404s on every meeting and
 * the reminder / post-meeting-check cron jobs scan nothing.
 */
function createSchedulingMeetingQueryPort() {
  return {
    async findById(meetingId) {
      return prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
          id: true,
          menteeId: true,
          mentorId: true,
          status: true,
          scheduledTime: true,
          moreTimesUsed: true,
          rescheduleUsed: true,
          retryAfterNoshowUsed: true,
        },
      });
    },

    async findScheduledMeetingsBetween({ scheduledFrom, scheduledUntil }) {
      return prisma.meeting.findMany({
        where: {
          status: MEETING_STATUS.SCHEDULED,
          scheduledTime: { gte: scheduledFrom, lte: scheduledUntil },
        },
        select: { id: true, menteeId: true, mentorId: true, scheduledTime: true },
      });
    },

    async findMeetingsAwaitingOutcome({ before }) {
      const meetings = await prisma.meeting.findMany({
        where: { status: MEETING_STATUS.SCHEDULED, scheduledTime: { lte: before } },
        select: { id: true, menteeId: true, mentorId: true, scheduledTime: true },
      });
      if (meetings.length === 0) return [];

      // MeetingOutcomeResponse is owned by the engagement module (no FK, by
      // design) but lives in the same database, so a plain read here is how
      // we know which of these meetings already got a full response from
      // both sides and shouldn't be nudged again.
      const responseCounts = await prisma.meetingOutcomeResponse.groupBy({
        by: ["meetingId"],
        where: { meetingId: { in: meetings.map((meeting) => meeting.id) } },
        _count: { _all: true },
      });
      const fullyAnswered = new Set(
        responseCounts
          .filter((row) => row._count._all >= 2)
          .map((row) => row.meetingId)
      );
      return meetings.filter((meeting) => !fullyAnswered.has(meeting.id));
    },
  };
}

module.exports = { createSchedulingMeetingQueryPort };
