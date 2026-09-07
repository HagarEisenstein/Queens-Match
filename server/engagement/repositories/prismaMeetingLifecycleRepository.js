const { LIFECYCLE_EVENTS } = require("../ports/meetingLifecyclePort");

function createPrismaMeetingLifecycleRepository(prisma) {
  return {
    async emit(eventName, payload = {}) {
      if (eventName === LIFECYCLE_EVENTS.ARRIVAL_RECORDED) {
        const data = payload.role === "mentee"
          ? { menteeArrivalConfirmed: true }
          : { mentorArrivalConfirmed: true };
        const meeting = await prisma.meeting.findUnique({ where: { id: payload.meetingId }, select: {
          menteeArrivalConfirmed: true, mentorArrivalConfirmed: true,
        } });
        const both = (meeting?.menteeArrivalConfirmed || data.menteeArrivalConfirmed) &&
          (meeting?.mentorArrivalConfirmed || data.mentorArrivalConfirmed);
        await prisma.meeting.update({ where: { id: payload.meetingId }, data: {
          ...data,
          ...(both ? { status: "arrival_confirmed" } : {}),
        } });
        return;
      }
      if (eventName === LIFECYCLE_EVENTS.OUTCOME_AGGREGATED) {
        const status = { completed: "completed", not_completed: "not_completed" }[payload.status];
        if (status) await prisma.meeting.update({ where: { id: payload.meetingId }, data: { status } });
        return;
      }
      if (eventName === LIFECYCLE_EVENTS.RETRY_PENDING) {
        await prisma.meeting.update({ where: { id: payload.meetingId }, data: { status: "pending_mentor_times", retryAfterNoshowUsed: true } });
        return;
      }
      if (eventName === LIFECYCLE_EVENTS.MEETING_NOT_COMPLETED) {
        await prisma.meeting.update({ where: { id: payload.meetingId }, data: { status: "not_completed" } });
      }
    },
  };
}

module.exports = { createPrismaMeetingLifecycleRepository };
