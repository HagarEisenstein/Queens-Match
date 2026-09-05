// Kept in sync with server/modules/scheduling/meetingStateMachine.js — the only
// values Meeting.status is ever assigned. There is no "arrival_confirmed",
// "completed", "not_completed", or "feedback_submitted" status: those are tracked
// as separate rows (MeetingOutcomeResponse, Feedback, FeedbackRequest) and surfaced
// through `meeting.isCompleted` / the alerts endpoint instead.
export const MEETING_STATUSES = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "rejected",
  "cancelled",
];

export const STATUS_LABELS = {
  pending_mentor_times: "Waiting for mentor times",
  pending_mentee_selection: "Waiting for mentee to pick",
  scheduled: "Scheduled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_COLORS = {
  pending_mentor_times: "#d97706",
  pending_mentee_selection: "#ca8a04",
  scheduled: "#2563eb",
  rejected: "#6b7280",
  cancelled: "#4b5563",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function statusColor(status) {
  return STATUS_COLORS[status] || "#6b7280";
}
