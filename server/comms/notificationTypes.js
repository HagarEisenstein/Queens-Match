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
  MEETING_CANCELLED: "meeting_cancelled",
  MENTOR_THANK_YOU: "mentor_thank_you",
});

/**
 * Notifications the product treats as important: they must reach the inbox even
 * if the recipient already saw them in the notification center, and they are
 * emailed immediately rather than after the digest delay.
 */
const IMPORTANT_NOTIFICATION_TYPES = Object.freeze(new Set([
  NOTIFICATION_TYPES.POST_MEETING_CHECK,
  NOTIFICATION_TYPES.FEEDBACK_REQUEST,
  NOTIFICATION_TYPES.MEETING_CANCELLED,
]));

module.exports = { NOTIFICATION_TYPES, IMPORTANT_NOTIFICATION_TYPES };
