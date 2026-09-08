import * as XLSX from "xlsx";
import { buildMeetingsWorkbook } from "./meetingsReportExport";

const meetings = [
  {
    id: "included",
    canonicalStatus: "completed",
    scheduledTime: "2026-09-04T10:00:00.000Z",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-04T12:00:00.000Z",
    meetingHappened: true,
    menteeFeedbackSubmitted: true,
    mentorFeedbackSubmitted: false,
    menteeRating: 5,
    mentorRating: null,
    mentee: { fullName: "Bella Bee", username: "bella", email: "bella@example.com" },
    mentor: { fullName: "Alice Ant", username: "alice", email: "alice@example.com" },
  },
];

describe("meetings report Excel export", () => {
  it("contains exactly the currently displayed rows and admin report columns", () => {
    const workbook = buildMeetingsWorkbook(meetings, XLSX);
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const savedWorkbook = XLSX.read(bytes, { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json(savedWorkbook.Sheets.Meetings, {
      raw: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Meeting ID": "included",
      Mentee: "Bella Bee",
      "Mentee Email": "bella@example.com",
      Mentor: "Alice Ant",
      "Mentor Email": "alice@example.com",
      Status: "Completed",
      "Meeting Happened": "Yes",
      "Mentee Feedback Submitted": "Yes",
      "Mentor Feedback Submitted": "No",
      "Mentee Rating": "5",
    });
    expect(JSON.stringify(rows)).not.toContain("excluded");
  });

  it("creates a safe empty workbook", () => {
    const workbook = buildMeetingsWorkbook([], XLSX);
    const sheet = workbook.Sheets.Meetings;

    expect(sheet["!ref"]).toBe("A1:N1");
    expect(XLSX.utils.sheet_to_json(sheet)).toEqual([]);
  });
});
