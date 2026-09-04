import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingFeedbackPage from "./MeetingFeedbackPage";
import apiClient from "../api/client";

jest.mock("../api/client", () => ({ post: jest.fn() }));

const MEETING_ID = "11111111-1111-1111-1111-111111111111";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/meetings/${MEETING_ID}/feedback`]}>
      <Routes>
        <Route path="/meetings/:id/feedback" element={<MeetingFeedbackPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingFeedbackPage", () => {
  afterEach(() => jest.resetAllMocks());

  it("POSTs rating and open text feedback", async () => {
    apiClient.post.mockResolvedValue({ data: { id: "f1", rating: 5 } });
    renderPage();

    fireEvent.change(screen.getByLabelText(/Open feedback/i), {
      target: { value: "Helpful conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        `/engagement/meetings/${MEETING_ID}/feedback`,
        { rating: 5, openText: "Helpful conversation" }
      )
    );
    expect(await screen.findByText(/Feedback submitted/i)).toBeInTheDocument();
  });
});
