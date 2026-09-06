import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeetingDetail from "./MeetingDetail";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn() }));

function renderAt(id) {
  return render(
    <MemoryRouter initialEntries={[`/admin/meetings/${id}`]}>
      <Routes>
        <Route path="/admin/meetings/:id" element={<MeetingDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MeetingDetail", () => {
  afterEach(() => jest.resetAllMocks());

  it("renders time slots, outcome responses, and feedback from the real shape", async () => {
    api.get.mockResolvedValue({
      data: {
        meeting: {
          id: "m1",
          status: "scheduled",
          scheduledTime: "2026-09-04T10:00:00.000Z",
          isCompleted: true,
          mentee: { id: "u1", username: "bella", email: "bella@example.com" },
          mentor: { id: "u2", username: "alice", email: "alice@example.com" },
          timeSlots: [
            { id: "s1", startTime: "2026-09-04T09:00:00.000Z", endTime: "2026-09-04T09:30:00.000Z" },
          ],
        },
        outcomeResponses: [
          { id: "o1", role: "mentee", happened: true },
        ],
        feedback: [{ id: "f1", rating: 5, openText: "Great session" }],
        feedbackRequests: [],
      },
    });

    renderAt("m1");

    expect(await screen.findByText(/bella \(bella@example.com\)/)).toBeInTheDocument();
    expect(screen.getByText("alice (alice@example.com)", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText(/Mentee: Reported: happened/)).toBeInTheDocument();
    expect(screen.getByText("Rating: 5/5")).toBeInTheDocument();
    expect(screen.getByText("Great session")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    api.get.mockRejectedValue({ response: { data: { error: { message: "Meeting not found." } } } });

    renderAt("missing");

    expect(await screen.findByText("Meeting not found.")).toBeInTheDocument();
  });
});
