// Single source of truth for how meeting statuses are labelled and coloured in
// the UI. Kept in one place so the meetings list, detail view, and (later) the
// admin calendar/report all speak the same visual language.

export const MEETING_STATUS = Object.freeze({
  PENDING_MENTOR_TIMES: "pending_mentor_times",
  PENDING_MENTEE_SELECTION: "pending_mentee_selection",
  SCHEDULED: "scheduled",
  REJECTED: "rejected",
});

const STATUS_META = {
  [MEETING_STATUS.PENDING_MENTOR_TIMES]: { label: "Awaiting mentor's times", color: "warning" },
  [MEETING_STATUS.PENDING_MENTEE_SELECTION]: { label: "Awaiting time selection", color: "info" },
  [MEETING_STATUS.SCHEDULED]: { label: "Scheduled", color: "success" },
  [MEETING_STATUS.REJECTED]: { label: "Rejected", color: "default" },
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
    case MEETING_STATUS.REJECTED:
      return "This request was declined.";
    default:
      return "";
  }
}
