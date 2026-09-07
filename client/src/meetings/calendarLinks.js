// Turn a scheduled meeting into "add to calendar" links. Everything here is
// pure and client-side: we never touch the API, so no auth token is needed and
// the same helpers work for Google Calendar (a prefilled TEMPLATE URL) and for
// Apple Calendar / Outlook / anything else (a downloadable .ics file).

const DEFAULT_DURATION_MINUTES = 30;

/** The counterpart in a meeting — the person the viewer is meeting with. */
function otherParty(meeting, currentUserId) {
  const iAmMentor = meeting.mentorId === currentUserId;
  return iAmMentor ? meeting.mentee : meeting.mentor;
}

/** A human title for the calendar event, from the viewer's point of view. */
export function meetingTitle(meeting, currentUserId) {
  const other = otherParty(meeting, currentUserId);
  const name = other?.fullName || other?.username || "a QueenB member";
  return `QueenB mentoring with ${name}`;
}

/**
 * The event's { start, end } as Dates. `scheduledTime` is the confirmed start;
 * the end comes from the offered slot the mentee picked (matched by start),
 * falling back to a 30-minute window when no slot lines up.
 */
export function meetingWindow(meeting) {
  const start = new Date(meeting.scheduledTime);
  const match = (meeting.timeSlots || []).find(
    (slot) => new Date(slot.startTime).getTime() === start.getTime()
  );
  const end = match
    ? new Date(match.endTime)
    : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  return { start, end };
}

/** Format a Date as the compact UTC stamp both Google and iCalendar expect. */
function toUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** A short human description reused in both the Google URL and the .ics body. */
function meetingDescription(meeting, currentUserId) {
  const other = otherParty(meeting, currentUserId);
  const name = other?.fullName || other?.username || "your match";
  return `QueenB mentoring meeting with ${name}. Manage it in Queens Match.`;
}

/**
 * A Google Calendar "create event" URL, prefilled with the meeting details.
 * Opening it drops the user on Google's new-event screen — they still confirm
 * the save themselves.
 */
export function googleCalendarUrl(meeting, currentUserId) {
  const { start, end } = meetingWindow(meeting);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meetingTitle(meeting, currentUserId),
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: meetingDescription(meeting, currentUserId),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape a value for an iCalendar text field (RFC 5545 §3.3.11). */
function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * A complete VCALENDAR document for one meeting. CRLF line endings and a stable
 * UID (the meeting id) keep it valid across Apple Calendar, Outlook and Google.
 */
export function buildIcs(meeting, currentUserId) {
  const { start, end } = meetingWindow(meeting);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Queens Match//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@queens-match`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeIcsText(meetingTitle(meeting, currentUserId))}`,
    `DESCRIPTION:${escapeIcsText(meetingDescription(meeting, currentUserId))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/**
 * Trigger a download of the meeting's .ics in the user's own browser, on their
 * own click. Opening the file adds the event to Apple Calendar (or whichever
 * app owns .ics on their device).
 */
export function downloadIcs(meeting, currentUserId) {
  const blob = new Blob([buildIcs(meeting, currentUserId)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `queenb-meeting-${meeting.id}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
