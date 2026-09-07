import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeetingCalendar from "./MeetingCalendar";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ get: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const scheduledMeeting = {
  id: "meet-scheduled",
  mentorId: "mentor-1",
  menteeId: "current-user",
  status: "scheduled",
  scheduledTime: "2026-12-01T15:00:00.000Z",
  mentor: { id: "mentor-1", fullName: "Nadia Mentor" },
  mentee: { id: "current-user", fullName: "Me Myself" },
  timeSlots: [
    { id: "s1", startTime: "2026-12-01T15:00:00.000Z", endTime: "2026-12-01T15:45:00.000Z" },
  ],
};

const pendingMeeting = {
  id: "meet-pending",
  mentorId: "mentor-2",
  menteeId: "current-user",
  status: "pending_mentee_selection",
  scheduledTime: null,
  mentor: { id: "mentor-2", fullName: "Pending Mentor" },
  mentee: { id: "current-user", fullName: "Me Myself" },
  timeSlots: [],
};

function renderCalendar() {
  return render(
    <MemoryRouter>
      <MeetingCalendar />
    </MemoryRouter>
  );
}

describe("MeetingCalendar", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: "current-user" } });
  });

  afterEach(() => jest.resetAllMocks());

  it("shows a loading indicator while meetings are in flight", () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));
    renderCalendar();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("lists only scheduled meetings and offers add-to-calendar controls", async () => {
    apiClient.get.mockResolvedValue({ data: [scheduledMeeting, pendingMeeting] });

    renderCalendar();

    // The scheduled meeting's counterpart shows up...
    await waitFor(() => expect(screen.getAllByText(/Nadia Mentor/).length).toBeGreaterThan(0));
    // ...the pending one never does.
    expect(screen.queryByText(/Pending Mentor/)).not.toBeInTheDocument();

    // Exactly one meeting is scheduled, so exactly one export pair renders.
    expect(screen.getAllByRole("link", { name: /Add to Google/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Apple \/ \.ics/ })).toHaveLength(1);
  });

  it("tells the user when there is nothing scheduled", async () => {
    apiClient.get.mockResolvedValue({ data: [pendingMeeting] });

    renderCalendar();

    await waitFor(() =>
      expect(screen.getByText(/no scheduled meetings yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("link", { name: /Add to Google/ })).not.toBeInTheDocument();
  });

  it("surfaces a clear error when the request fails", async () => {
    apiClient.get.mockRejectedValue(new Error("boom"));

    renderCalendar();

    await waitFor(() =>
      expect(screen.getByText(/calendar could not be loaded/i)).toBeInTheDocument()
    );
  });
});
