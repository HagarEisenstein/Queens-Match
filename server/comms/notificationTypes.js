const NOTIFICATION_TYPES = Object.freeze({
  REQUEST_RECEIVED: "request_received",
  TIMES_OFFERED: "times_offered",
  MEETING_REJECTED: "meeting_rejected",
  MEETING_MATCHED: "meeting_matched",
  MEETING_REMINDER: "meeting_reminder",
  ARRIVAL_CHECK: "arrival_check",
  POST_MEETING_CHECK: "post_meeting_check",
  FEEDBACK_REQUEST: "feedback_request",
  FEEDBACK_REMINDER: "feedback_reminder",
  MENTOR_THANK_YOU: "mentor_thank_you",
  MORE_TIMES_REQUESTED: "more_times_requested",
  MEETING_DECLINED_BY_MENTEE: "meeting_declined_by_mentee",
  MEETING_RESCHEDULE_REQUESTED: "meeting_reschedule_requested",
  MEETING_CANCELLED: "meeting_cancelled",
  MEETING_REOPENED_AFTER_NO_SHOW: "meeting_reopened_after_no_show",
});

module.exports = { NOTIFICATION_TYPES };
