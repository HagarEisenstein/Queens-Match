import { statusLabel } from "./meetingStatus";

const COLUMNS = [
  "Meeting ID",
  "Mentee",
  "Mentee Email",
  "Mentor",
  "Mentor Email",
  "Status",
  "Scheduled Time",
  "Meeting Happened",
  "Mentee Feedback Submitted",
  "Mentor Feedback Submitted",
  "Mentee Rating",
  "Mentor Rating",
  "Created At",
  "Updated At",
];

function participantName(participant, fallbackId) {
  return participant?.fullName || participant?.username || fallbackId || "";
}

function yesNo(value) {
  if (value == null) return "";
  return value ? "Yes" : "No";
}

function excelDate(value) {
  return value ? new Date(value) : "";
}

function toExportRow(meeting) {
  return {
    "Meeting ID": meeting.id,
    Mentee: participantName(meeting.mentee, meeting.menteeId),
    "Mentee Email": meeting.mentee?.email || "",
    Mentor: participantName(meeting.mentor, meeting.mentorId),
    "Mentor Email": meeting.mentor?.email || "",
    Status: statusLabel(meeting.canonicalStatus || meeting.status),
    "Scheduled Time": excelDate(meeting.scheduledTime),
    "Meeting Happened": yesNo(meeting.meetingHappened),
    "Mentee Feedback Submitted": yesNo(meeting.menteeFeedbackSubmitted),
    "Mentor Feedback Submitted": yesNo(meeting.mentorFeedbackSubmitted),
    "Mentee Rating": meeting.menteeRating ?? "",
    "Mentor Rating": meeting.mentorRating ?? "",
    "Created At": excelDate(meeting.createdAt),
    "Updated At": excelDate(meeting.updatedAt),
  };
}

export function buildMeetingsWorkbook(meetings, spreadsheet) {
  const worksheet = spreadsheet.utils.json_to_sheet(meetings.map(toExportRow), {
    header: COLUMNS,
  });
  worksheet["!cols"] = COLUMNS.map((column) => ({
    wch: Math.max(column.length + 2, 16),
  }));
  const workbook = spreadsheet.utils.book_new();
  spreadsheet.utils.book_append_sheet(workbook, worksheet, "Meetings");
  return workbook;
}

export async function downloadMeetingsExcel(meetings) {
  const module = await import("xlsx");
  const spreadsheet = module.default || module;
  spreadsheet.writeFile(
    buildMeetingsWorkbook(meetings, spreadsheet),
    "meetings-report.xlsx",
    { compression: true }
  );
}
