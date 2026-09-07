// Single source of truth for how meeting statuses are labelled and coloured in
// the UI. Kept in one place so the meetings list, detail view, match cards,
// and (later) the admin calendar/report all speak the same visual language.

export const MEETING_STATUS = Object.freeze({
  PENDING_MENTOR_TIMES: "pending_mentor_times",
  PENDING_MENTEE_SELECTION: "pending_mentee_selection",
  SCHEDULED: "scheduled",
  ARRIVAL_CONFIRMED: "arrival_confirmed",
  COMPLETED: "completed",
  NOT_COMPLETED: "not_completed",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

// Mirrors server/modules/scheduling/meetingStateMachine.js TERMINAL_STATUSES —
// statuses from which no further coordination is expected.
export const TERMINAL_STATUSES = Object.freeze([
  MEETING_STATUS.FEEDBACK_SUBMITTED,
  MEETING_STATUS.REJECTED,
  MEETING_STATUS.CANCELLED,
]);

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

const STATUS_META = {
  [MEETING_STATUS.PENDING_MENTOR_TIMES]: { label: "Awaiting mentor's times", color: "warning" },
  [MEETING_STATUS.PENDING_MENTEE_SELECTION]: { label: "Awaiting time selection", color: "info" },
  [MEETING_STATUS.SCHEDULED]: { label: "Scheduled", color: "success" },
  [MEETING_STATUS.ARRIVAL_CONFIRMED]: { label: "Arrival confirmed", color: "success" },
  [MEETING_STATUS.COMPLETED]: { label: "Completed", color: "success" },
  [MEETING_STATUS.NOT_COMPLETED]: { label: "Not completed", color: "default" },
  [MEETING_STATUS.FEEDBACK_SUBMITTED]: { label: "Feedback submitted", color: "default" },
  [MEETING_STATUS.REJECTED]: { label: "Rejected", color: "default" },
  [MEETING_STATUS.CANCELLED]: { label: "Cancelled", color: "default" },
};

export function statusMeta(status) {
  return STATUS_META[status] || { label: status, color: "default" };
}

/**
 * A short, viewer-aware sentence describing what (if anything) this person owes.
 * `role` is "mentor" or "mentee" — the side the viewer plays in this meeting.
 */
export function statusPrompt(status, role) {
  switch (status) {
    case MEETING_STATUS.PENDING_MENTOR_TIMES:
      return role === "mentor"
        ? "Offer some times or decline this request."
        : "Waiting for the mentor to offer times.";
    case MEETING_STATUS.PENDING_MENTEE_SELECTION:
      return role === "mentee"
        ? "Pick one of the offered times to confirm."
        : "Waiting for the mentee to pick a time.";
    case MEETING_STATUS.SCHEDULED:
      return "This meeting is confirmed.";
    case MEETING_STATUS.ARRIVAL_CONFIRMED:
      return "Arrival has been confirmed for this meeting.";
    case MEETING_STATUS.COMPLETED:
      return "This meeting has taken place.";
    case MEETING_STATUS.NOT_COMPLETED:
      return "This meeting did not happen as planned.";
    case MEETING_STATUS.FEEDBACK_SUBMITTED:
      return "Feedback has been submitted for this meeting.";
    case MEETING_STATUS.REJECTED:
      return "This request was declined.";
    case MEETING_STATUS.CANCELLED:
      return "This meeting was cancelled.";
    default:
      return "";
  }
}
