import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingDetail from "./MeetingDetail";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./OfferTimesCalendar", () => () => <div>Offer times calendar</div>);
jest.mock("./AddToCalendarButtons", () => () => <div>Add to calendar</div>);

const MEETING_ID = "11111111-1111-1111-1111-111111111111";
const MENTOR_ID = "22222222-2222-2222-2222-222222222222";
const MENTEE_ID = "33333333-3333-3333-3333-333333333333";

function renderPage(entry = `/meetings/${MEETING_ID}`) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/meetings/:id" element={<MeetingDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingDetail", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    useAuth.mockReturnValue({
      user: { id: MENTOR_ID, roles: ["mentor"], username: "mentor" },
    });
  });

  it("opens the mentor retry flow from the notification deep link", async () => {
    apiClient.get
      .mockResolvedValueOnce({
        data: {
          id: MEETING_ID,
          mentorId: MENTOR_ID,
          menteeId: MENTEE_ID,
          status: "pending_mentor_times",
          moreTimesUsed: true,
          timeSlots: [],
          mentee: { id: MENTEE_ID, username: "mentee", fullName: "Mentee User" },
          mentor: { id: MENTOR_ID, username: "mentor", fullName: "Mentor User" },
        },
      })
      .mockResolvedValueOnce({
        data: { meetingLengthMinutes: 45 },
      });

    renderPage(`/meetings/${MEETING_ID}?action=offer-times`);

    expect(await screen.findByRole("heading", { name: "Offer another round of times" })).toBeInTheDocument();
    expect(screen.getByText("Offer times calendar")).toBeInTheDocument();
    await waitFor(() =>
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    );
  });

  describe("cancelling a meeting", () => {
    function scheduledMeeting(status = "scheduled") {
      return {
        id: MEETING_ID,
        mentorId: MENTOR_ID,
        menteeId: MENTEE_ID,
        status,
        scheduledTime: "2026-09-10T15:00:00.000Z",
        timeSlots: [],
        mentee: { id: MENTEE_ID, username: "mentee", fullName: "Mentee User" },
        mentor: { id: MENTOR_ID, username: "mentor", fullName: "Mentor User" },
      };
    }

    it("offers a Cancel Meeting button on an active meeting", async () => {
      apiClient.get.mockResolvedValue({ data: scheduledMeeting() });

      renderPage();

      expect(await screen.findByRole("button", { name: "Cancel Meeting" })).toBeEnabled();
    });

    it("hides the Cancel Meeting button once the meeting is terminal", async () => {
      apiClient.get.mockResolvedValue({ data: scheduledMeeting("cancelled") });

      renderPage();

      await screen.findByText(/This meeting was cancelled\./i);
      expect(screen.queryByRole("button", { name: "Cancel Meeting" })).not.toBeInTheDocument();
    });

    it("requires confirmation before calling the cancel endpoint", async () => {
      apiClient.get.mockResolvedValue({ data: scheduledMeeting() });

      renderPage();
      await userEvent.click(await screen.findByRole("button", { name: "Cancel Meeting" }));

      expect(await screen.findByText("Cancel this meeting?")).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Keep meeting" }));

      await waitFor(() =>
        expect(screen.queryByText("Cancel this meeting?")).not.toBeInTheDocument()
      );
      expect(apiClient.post).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Cancel Meeting" })).toBeInTheDocument();
    });

    it("cancels and refreshes the meeting state after confirmation", async () => {
      apiClient.get.mockResolvedValue({ data: scheduledMeeting() });
      apiClient.post.mockResolvedValue({ data: scheduledMeeting("cancelled") });

      renderPage();
      await userEvent.click(await screen.findByRole("button", { name: "Cancel Meeting" }));
      await userEvent.click(screen.getByRole("button", { name: "Yes, cancel meeting" }));

      await waitFor(() =>
        expect(apiClient.post).toHaveBeenCalledWith(`/meetings/${MEETING_ID}/cancel`)
      );
      expect(await screen.findByText(/This meeting was cancelled\./i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel Meeting" })).not.toBeInTheDocument();
    });
  });
});
