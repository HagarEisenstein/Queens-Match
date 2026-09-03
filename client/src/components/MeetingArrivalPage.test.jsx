import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingArrivalPage from "./MeetingArrivalPage";
import apiClient from "../api/client";

jest.mock("../api/client", () => ({ put: jest.fn() }));

const MEETING_ID = "11111111-1111-1111-1111-111111111111";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/meetings/${MEETING_ID}/arrival`]}>
      <Routes>
        <Route path="/meetings/:id/arrival" element={<MeetingArrivalPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingArrivalPage", () => {
  afterEach(() => jest.resetAllMocks());

  it("PUTs arrival confirmation for the meeting", async () => {
    apiClient.put.mockResolvedValue({ data: { recorded: true } });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "I will attend" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        `/engagement/meetings/${MEETING_ID}/arrival`
      )
    );
    expect(await screen.findByText("Arrival confirmed.")).toBeInTheDocument();
  });
});
