import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingDetail from "./MeetingDetail";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const MEETING_ID = "11111111-1111-1111-1111-111111111111";
const MENTOR_ID = "22222222-2222-2222-2222-222222222222";
const MENTEE_ID = "33333333-3333-3333-3333-333333333333";

const mentor = { id: MENTOR_ID, username: "mentor1", fullName: "Mona Mentor" };
const mentee = { id: MENTEE_ID, username: "mentee1", fullName: "Mia Mentee" };

function baseMeeting(overrides = {}) {
  return {
    id: MEETING_ID,
    mentorId: MENTOR_ID,
    menteeId: MENTEE_ID,
    mentor,
    mentee,
    status: "pending_mentee_selection",
    timeSlots: [
      { id: "slot-1", startTime: "2026-11-01T10:00:00.000Z", endTime: "2026-11-01T10:30:00.000Z" },
    ],
    moreTimesUsed: false,
    rescheduleUsed: false,
    ...overrides,
  };
}

function renderAs(userId) {
  useAuth.mockReturnValue({ user: { id: userId } });
  return render(
    <MemoryRouter initialEntries={[`/meetings/${MEETING_ID}`]}>
      <Routes>
        <Route path="/meetings/:id" element={<MeetingDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingDetail — Epic 4 re-coordination", () => {
  afterEach(() => jest.resetAllMocks());

  it("lets the mentee ask for more times once, and hides that option after it's used", async () => {
    apiClient.get.mockResolvedValue({ data: baseMeeting({ moreTimesUsed: false }) });
    renderAs(MENTEE_ID);

    expect(await screen.findByRole("button", { name: "Ask for more times" })).toBeInTheDocument();

    apiClient.post.mockResolvedValue({ data: baseMeeting({ status: "pending_mentor_times", moreTimesUsed: true }) });
    fireEvent.click(screen.getByRole("button", { name: "Ask for more times" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(`/meetings/${MEETING_ID}/request-more-times`)
    );
  });

  it("only offers decline once the mentee's one retry is already spent", async () => {
    apiClient.get.mockResolvedValue({ data: baseMeeting({ moreTimesUsed: true }) });
    renderAs(MENTEE_ID);

    expect(await screen.findByRole("button", { name: "Decline — none of these work for me" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask for more times" })).not.toBeInTheDocument();
  });

  it("posts a decline for the mentee", async () => {
    apiClient.get.mockResolvedValue({ data: baseMeeting({ moreTimesUsed: true }) });
    apiClient.post.mockResolvedValue({ data: baseMeeting({ status: "rejected", moreTimesUsed: true }) });
    renderAs(MENTEE_ID);

    fireEvent.click(await screen.findByRole("button", { name: "Decline — none of these work for me" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(`/meetings/${MEETING_ID}/decline`)
    );
  });

  it("lets either side flag can't-make-it on a scheduled meeting, and warns the second use cancels it", async () => {
    apiClient.get.mockResolvedValue({
      data: baseMeeting({ status: "scheduled", scheduledTime: "2026-11-01T10:00:00.000Z", rescheduleUsed: true }),
    });
    renderAs(MENTOR_ID);

    const button = await screen.findByRole("button", { name: "Cancel this meeting" });
    expect(screen.getByText(/no more retries/i)).toBeInTheDocument();

    apiClient.post.mockResolvedValue({ data: baseMeeting({ status: "cancelled" }) });
    fireEvent.click(button);

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(`/meetings/${MEETING_ID}/cant-make-it`)
    );
  });

  it("shows a cancelled banner", async () => {
    apiClient.get.mockResolvedValue({ data: baseMeeting({ status: "cancelled" }) });
    renderAs(MENTEE_ID);

    expect(await screen.findByText(/cancelled after a second scheduling conflict/i)).toBeInTheDocument();
  });
});
