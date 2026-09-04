const { AppError } = require("../middleware/errors");
const { aggregateOutcome } = require("./aggregateOutcome");
const {
  LIFECYCLE_EVENTS,
} = require("./ports/meetingLifecyclePort");

function createOutcomeService({
  outcomeRepository,
  meetingQueryPort,
  meetingLifecyclePort,
  blocklistService,
  feedbackService,
  eventBus,
  now = () => new Date(),
}) {
  async function loadMeetingOrThrow(meetingId) {
    const meeting = await meetingQueryPort.findById(meetingId);
    if (!meeting) {
      throw new AppError(404, "NOT_FOUND", "Meeting not found.");
    }
    return meeting;
  }

  function roleForUser(meeting, userId) {
    if (meeting.menteeId === userId) return "mentee";
    if (meeting.mentorId === userId) return "mentor";
    return null;
  }

  async function getOutcomes(meetingId, user) {
    const meeting = await loadMeetingOrThrow(meetingId);
    const role = roleForUser(meeting, user.id);
    const isAdmin = user.roles?.includes("admin");
    if (!role && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You cannot access this meeting.");
    }

    const responses = await outcomeRepository.findByMeetingId(meetingId);
    const menteeOutcome = responses.find((item) => item.role === "mentee") || null;
    const mentorOutcome = responses.find((item) => item.role === "mentor") || null;
    const aggregation = aggregateOutcome({
      menteeOutcome,
      mentorOutcome,
      retryAfterNoshowUsed: Boolean(meeting.retryAfterNoshowUsed),
    });

    return {
      meetingId,
      responses,
      aggregation,
    };
  }

  async function submitOutcome(
    meetingId,
    user,
    { happened, absentParty = null, stillWantToMeet = null }
  ) {
    const meeting = await loadMeetingOrThrow(meetingId);
    const role = roleForUser(meeting, user.id);
    if (!role) {
      throw new AppError(403, "FORBIDDEN", "Only meeting participants can submit outcomes.");
    }

    if (typeof happened !== "boolean") {
      throw new AppError(400, "VALIDATION_ERROR", "happened must be a boolean.");
    }

    if (!happened) {
      const allowedAbsent = new Set(["self", "other", "both", "unclear"]);
      if (absentParty != null && !allowedAbsent.has(absentParty)) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "absentParty must be self, other, both, or unclear."
        );
      }
      if (stillWantToMeet != null && typeof stillWantToMeet !== "boolean") {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "stillWantToMeet must be a boolean."
        );
      }
    }

    const saved = await outcomeRepository.upsertOutcome({
      meetingId,
      respondentId: user.id,
      role,
      happened,
      absentParty: happened ? null : absentParty,
      stillWantToMeet: happened ? null : stillWantToMeet,
    });

    const responses = await outcomeRepository.findByMeetingId(meetingId);
    const menteeOutcome = responses.find((item) => item.role === "mentee") || null;
    const mentorOutcome = responses.find((item) => item.role === "mentor") || null;
    const aggregation = aggregateOutcome({
      menteeOutcome,
      mentorOutcome,
      retryAfterNoshowUsed: Boolean(meeting.retryAfterNoshowUsed),
    });

    if (
      aggregation.mentorGhosted &&
      aggregation.status !== "admin_review" &&
      menteeOutcome &&
      mentorOutcome
    ) {
      await blocklistService.blockMentorForMentee({
        menteeId: meeting.menteeId,
        mentorId: meeting.mentorId,
        meetingId: meeting.id,
        reason: "mentor_ghosted",
      });
    }

    await meetingLifecyclePort.emit(LIFECYCLE_EVENTS.OUTCOME_AGGREGATED, {
      meetingId: meeting.id,
      status: aggregation.status,
      mentorGhosted: aggregation.mentorGhosted,
      at: now().toISOString(),
    });

    if (aggregation.status === "completed") {
      await feedbackService.requestFeedbackForMeeting(meeting);
      if (eventBus) {
        eventBus.emit("MeetingCompleted", {
          meetingId: meeting.id,
          mentorId: meeting.mentorId,
          menteeId: meeting.menteeId,
        });
      }
      await meetingLifecyclePort.emit(LIFECYCLE_EVENTS.MEETING_COMPLETED, {
        meetingId: meeting.id,
        mentorId: meeting.mentorId,
        menteeId: meeting.menteeId,
      });
    } else if (aggregation.status === "retry_pending") {
      await meetingLifecyclePort.emit(LIFECYCLE_EVENTS.RETRY_PENDING, {
        meetingId: meeting.id,
      });
    } else if (aggregation.status === "not_completed") {
      await meetingLifecyclePort.emit(LIFECYCLE_EVENTS.MEETING_NOT_COMPLETED, {
        meetingId: meeting.id,
      });
    }

    return {
      outcome: saved,
      aggregation,
      responses,
    };
  }

  async function recordArrival(meetingId, user) {
    const meeting = await loadMeetingOrThrow(meetingId);
    const role = roleForUser(meeting, user.id);
    if (!role) {
      throw new AppError(403, "FORBIDDEN", "Only meeting participants can confirm arrival.");
    }

    await meetingLifecyclePort.emit(LIFECYCLE_EVENTS.ARRIVAL_RECORDED, {
      meetingId: meeting.id,
      userId: user.id,
      role,
      at: now().toISOString(),
    });

    return {
      meetingId: meeting.id,
      userId: user.id,
      role,
      recorded: true,
    };
  }

  return {
    submitOutcome,
    getOutcomes,
    recordArrival,
  };
}

module.exports = { createOutcomeService };
