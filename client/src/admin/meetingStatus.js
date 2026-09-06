// Kept in sync with server/modules/scheduling/meetingStateMachine.js — the only
export const MEETING_STATUSES = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "arrival_confirmed",
  "completed",
  "not_completed",
  "feedback_submitted",
  "admin_review",
  "rejected",
  "cancelled",
];

export const STATUS_LABELS = {
  pending_mentor_times: "Waiting for mentor times",
  pending_mentee_selection: "Waiting for mentee to pick",
  scheduled: "Scheduled",
  arrival_confirmed: "Arrival confirmed",
  completed: "Completed",
  not_completed: "Not completed",
  feedback_submitted: "Feedback submitted",
  admin_review: "Admin review",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const STATUS_COLORS = {
  pending_mentor_times: "#d97706",
  pending_mentee_selection: "#ca8a04",
  scheduled: "#2563eb",
  arrival_confirmed: "#7c3aed",
  completed: "#16a34a",
  not_completed: "#dc2626",
  feedback_submitted: "#059669",
  admin_review: "#ea580c",
  rejected: "#6b7280",
  cancelled: "#4b5563",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function statusColor(status) {
  return STATUS_COLORS[status] || "#6b7280";
}
