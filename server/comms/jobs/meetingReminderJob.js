const { NOTIFICATION_TYPES } = require("../notificationTypes");

const TWO_DAYS_IN_MILLISECONDS = 2 * 24 * 60 * 60 * 1000;
const ONE_HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

function createMeetingReminderJob({
  meetingRepository,
  notificationService,
  reminderLeadTimeMilliseconds = TWO_DAYS_IN_MILLISECONDS,
  scanWindowMilliseconds = ONE_HOUR_IN_MILLISECONDS,
}) {
  async function run(now = new Date()) {
    const scheduledFrom = new Date(now.getTime() + reminderLeadTimeMilliseconds);
    const scheduledUntil = new Date(scheduledFrom.getTime() + scanWindowMilliseconds);
    const meetings = await meetingRepository.findScheduledMeetingsBetween({
      scheduledFrom,
      scheduledUntil,
    });

    for (const meeting of meetings) {
      const scheduledTime = new Date(meeting.scheduledTime).toISOString();
      const recipientIds = [meeting.menteeId, meeting.mentorId];

      for (const recipientId of recipientIds) {
        await notificationService.send({
          recipientId,
          meetingId: meeting.id,
          type: NOTIFICATION_TYPES.MEETING_REMINDER,
          title: "Meeting reminder",
          message: `Your meeting is scheduled for ${scheduledTime}.`,
          actionUrl: `/meetings/${meeting.id}`,
          deduplicationKey: `${NOTIFICATION_TYPES.MEETING_REMINDER}:${meeting.id}:${recipientId}:${scheduledTime}`,
        });
        await notificationService.send({
          recipientId,
          meetingId: meeting.id,
          type: NOTIFICATION_TYPES.ARRIVAL_CHECK,
          title: "Confirm your arrival",
          message: "Open the meeting in QueenB and confirm that you plan to attend.",
          actionUrl: `/meetings/${meeting.id}/arrival`,
          deduplicationKey: `${NOTIFICATION_TYPES.ARRIVAL_CHECK}:${meeting.id}:${recipientId}:${scheduledTime}`,
        });
      }
    }
  }

  return { run };
}

module.exports = { createMeetingReminderJob };
