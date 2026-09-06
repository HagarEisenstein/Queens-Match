import {
  meetingTitle,
  meetingWindow,
  googleCalendarUrl,
  buildIcs,
} from "./calendarLinks";

const CURRENT_USER = "mentee-1";

// A confirmed meeting whose scheduled start matches one offered slot.
const meeting = {
  id: "abc-123",
  mentorId: "mentor-9",
  menteeId: "mentee-1",
  status: "scheduled",
  scheduledTime: "2026-09-10T14:00:00.000Z",
  mentor: { id: "mentor-9", fullName: "Dana, Mentor; Lead" },
  mentee: { id: "mentee-1", fullName: "Mia Mentee" },
  timeSlots: [
    { id: "s1", startTime: "2026-09-10T14:00:00.000Z", endTime: "2026-09-10T14:45:00.000Z" },
    { id: "s2", startTime: "2026-09-11T09:00:00.000Z", endTime: "2026-09-11T09:45:00.000Z" },
  ],
};

describe("calendarLinks", () => {
  it("titles the event with the counterpart, from the viewer's side", () => {
    // The mentee sees the mentor's name...
    expect(meetingTitle(meeting, CURRENT_USER)).toContain("Dana, Mentor; Lead");
    // ...and the mentor sees the mentee's name.
    expect(meetingTitle(meeting, "mentor-9")).toContain("Mia Mentee");
  });

  it("takes the end time from the matching offered slot", () => {
    const { start, end } = meetingWindow(meeting);
    expect(start.toISOString()).toBe("2026-09-10T14:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-10T14:45:00.000Z");
  });

  it("falls back to a 30-minute window when no slot matches the start", () => {
    const orphan = { ...meeting, timeSlots: [] };
    const { start, end } = meetingWindow(orphan);
    expect(end.getTime() - start.getTime()).toBe(30 * 60 * 1000);
  });

  it("builds a Google URL with a UTC start/end date range", () => {
    const url = googleCalendarUrl(meeting, CURRENT_USER);
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    // dates=20260910T140000Z/20260910T144500Z (URL-encoded slash)
    const dates = new URL(url).searchParams.get("dates");
    expect(dates).toBe("20260910T140000Z/20260910T144500Z");
  });

  it("produces a valid VEVENT with escaped text and CRLF lines", () => {
    const ics = buildIcs(meeting, CURRENT_USER);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc-123@queens-match");
    expect(ics).toContain("DTSTART:20260910T140000Z");
    expect(ics).toContain("DTEND:20260910T144500Z");
    // Commas and semicolons in the name must be escaped in SUMMARY.
    expect(ics).toContain("SUMMARY:QueenB mentoring with Dana\\, Mentor\\; Lead");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.split("\r\n").length).toBeGreaterThan(5);
  });
});
