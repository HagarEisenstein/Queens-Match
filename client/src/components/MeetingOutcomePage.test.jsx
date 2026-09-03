import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingOutcomePage from "./MeetingOutcomePage";
import apiClient from "../api/client";

jest.mock("../api/client", () => ({ put: jest.fn() }));

const MEETING_ID = "11111111-1111-1111-1111-111111111111";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/meetings/${MEETING_ID}/outcome`]}>
      <Routes>
        <Route path="/meetings/:id/outcome" element={<MeetingOutcomePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingOutcomePage", () => {
  afterEach(() => jest.resetAllMocks());

  it("submits a happened=true outcome", async () => {
    apiClient.put.mockResolvedValue({ data: { aggregation: { status: "awaiting_responses" } } });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Submit outcome" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        `/engagement/meetings/${MEETING_ID}/outcome`,
        { happened: true, absentParty: null, stillWantToMeet: null }
      )
    );
    expect(await screen.findByText("Outcome saved.")).toBeInTheDocument();
  });

  it("includes absentParty and stillWantToMeet when the meeting did not happen", async () => {
    apiClient.put.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(screen.getByLabelText("No"));
    fireEvent.click(screen.getByRole("button", { name: "Submit outcome" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        `/engagement/meetings/${MEETING_ID}/outcome`,
        expect.objectContaining({
          happened: false,
          absentParty: "unclear",
          stillWantToMeet: true,
        })
      )
    );
  });
});
