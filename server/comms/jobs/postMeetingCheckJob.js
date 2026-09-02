const { NOTIFICATION_TYPES } = require("../notificationTypes");

function createPostMeetingCheckJob({ meetingRepository, notificationService }) {
  async function run(now = new Date()) {
    const meetings = await meetingRepository.findMeetingsAwaitingOutcome({ before: now });

    for (const meeting of meetings) {
      for (const recipientId of [meeting.menteeId, meeting.mentorId]) {
        await notificationService.send({
          recipientId,
          meetingId: meeting.id,
          type: NOTIFICATION_TYPES.POST_MEETING_CHECK,
          title: "Did your meeting happen?",
          message: "Open the meeting in QueenB and tell us whether it happened.",
          deduplicationKey: `${NOTIFICATION_TYPES.POST_MEETING_CHECK}:${meeting.id}:${recipientId}`,
        });
      }
    }
  }

  return { run };
}

module.exports = { createPostMeetingCheckJob };
