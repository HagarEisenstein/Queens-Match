const { AppError } = require("../middleware/errors");
const { NOTIFICATION_TYPES } = require("../comms/notificationTypes");

function createFeedbackService({
  feedbackRepository,
  meetingQueryPort,
  notificationService,
  now = () => new Date(),
}) {
  async function assertParticipantOrAdmin(meetingId, user) {
    const meeting = await meetingQueryPort.findById(meetingId);
    if (!meeting) {
      throw new AppError(404, "NOT_FOUND", "Meeting not found.");
    }
    const isParticipant =
      meeting.menteeId === user.id || meeting.mentorId === user.id;
    const isAdmin = user.roles?.includes("admin");
    if (!isParticipant && !isAdmin) {
      throw new AppError(403, "FORBIDDEN", "You cannot access this meeting.");
    }
    return meeting;
  }

  async function requestFeedbackForMeeting(meeting) {
    const requestedAt = now();
    const recipients = [meeting.menteeId, meeting.mentorId];
    const requests = await feedbackRepository.createFeedbackRequests(
      recipients.map((recipientId) => ({
        meetingId: meeting.id,
        recipientId,
        feedbackRequestedAt: requestedAt,
      }))
    );

    if (notificationService) {
      for (const recipientId of recipients) {
        await notificationService.send({
          recipientId,
          meetingId: meeting.id,
          type: NOTIFICATION_TYPES.FEEDBACK_REQUEST,
          title: "Please leave meeting feedback",
          message: "Share a short rating and note about your mentoring meeting.",
          actionUrl: `/meetings/${meeting.id}/feedback`,
          deduplicationKey: `${NOTIFICATION_TYPES.FEEDBACK_REQUEST}:${meeting.id}:${recipientId}`,
        });
      }
    }

    return requests;
  }

  async function submitFeedback(meetingId, user, { rating, openText }) {
    const meeting = await assertParticipantOrAdmin(meetingId, user);
    const isParticipant =
      meeting.menteeId === user.id || meeting.mentorId === user.id;
    if (!isParticipant) {
      throw new AppError(403, "FORBIDDEN", "Only participants can submit feedback.");
    }

    const existing = await feedbackRepository.findByMeetingAndSubmitter(
      meetingId,
      user.id
    );
    if (existing) {
      throw new AppError(
        409,
        "FEEDBACK_EXISTS",
        "Feedback for this meeting was already submitted."
      );
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, "VALIDATION_ERROR", "Rating must be an integer from 1 to 5.");
    }

    const feedback = await feedbackRepository.createFeedback({
      meetingId,
      submittedBy: user.id,
      rating,
      openText: openText == null ? null : String(openText),
    });

    await feedbackRepository.markFeedbackRequestFulfilled(meetingId, user.id);
    return feedback;
  }

  async function listFeedback(meetingId, user) {
    await assertParticipantOrAdmin(meetingId, user);
    return feedbackRepository.findByMeetingId(meetingId);
  }

  async function findOutstandingFeedbackRequests() {
    return feedbackRepository.findOutstandingFeedbackRequests();
  }

  return {
    requestFeedbackForMeeting,
    submitFeedback,
    listFeedback,
    findOutstandingFeedbackRequests,
  };
}

module.exports = { createFeedbackService };
