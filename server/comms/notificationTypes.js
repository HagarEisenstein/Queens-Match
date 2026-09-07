const NOTIFICATION_TYPES = Object.freeze({
  WELCOME: "welcome",
  REQUEST_RECEIVED: "request_received",
  TIMES_OFFERED: "times_offered",
  MORE_TIMES_REQUESTED: "more_times_requested",
  MEETING_REJECTED: "meeting_rejected",
  MEETING_DECLINED: "meeting_declined",
  MEETING_MATCHED: "meeting_matched",
  MEETING_REMINDER: "meeting_reminder",
  ARRIVAL_CHECK: "arrival_check",
  POST_MEETING_CHECK: "post_meeting_check",
  FEEDBACK_REQUEST: "feedback_request",
  FEEDBACK_REMINDER: "feedback_reminder",
  MENTOR_THANK_YOU: "mentor_thank_you",
});

module.exports = { NOTIFICATION_TYPES };
