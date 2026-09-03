const { NOTIFICATION_TYPES } = require("../notificationTypes");

const TWO_DAYS_IN_MILLISECONDS = 2 * 24 * 60 * 60 * 1000;

function createFeedbackReminderJob({
  feedbackRepository,
  notificationService,
  reminderIntervalMilliseconds = TWO_DAYS_IN_MILLISECONDS,
}) {
  async function run(now = new Date()) {
    const outstandingFeedbackRequests = await feedbackRepository.findOutstandingFeedbackRequests();

    for (const feedbackRequest of outstandingFeedbackRequests) {
      const elapsedMilliseconds = now.getTime() - new Date(feedbackRequest.feedbackRequestedAt).getTime();
      const completedReminderPeriods = Math.floor(elapsedMilliseconds / reminderIntervalMilliseconds);

      if (completedReminderPeriods < 1) {
        continue;
      }

      await notificationService.send({
        recipientId: feedbackRequest.recipientId,
        meetingId: feedbackRequest.meetingId,
        type: NOTIFICATION_TYPES.FEEDBACK_REMINDER,
        title: "Meeting feedback reminder",
        message: "Please open QueenB and submit your meeting feedback.",
        deduplicationKey: `${NOTIFICATION_TYPES.FEEDBACK_REMINDER}:${feedbackRequest.meetingId}:${feedbackRequest.recipientId}:${completedReminderPeriods}`,
        emailEligible: completedReminderPeriods === 1,
        popupEligible: completedReminderPeriods <= 3,
      });
    }
  }

  return { run };
}

module.exports = { createFeedbackReminderJob };
