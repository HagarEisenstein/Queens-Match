import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Alerts from "./Alerts";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn() }));

describe("Alerts", () => {
  afterEach(() => jest.resetAllMocks());

  it("renders each R15 alert section from the real API shape", async () => {
    api.get.mockResolvedValue({
      data: {
        alerts: {
          meetingsNotCompleted: [
            {
              id: "m1",
              status: "scheduled",
              scheduledTime: null,
              mentee: { username: "bella" },
              mentor: { username: "alice" },
            },
          ],
          overdueFeedback: [
            {
              meetingId: "m2",
              recipient: { username: "carla" },
              feedbackRequestedAt: "2026-08-01T00:00:00.000Z",
            },
          ],
          overloadedMentors: [
            { mentorId: "u2", completedCount: 11, mentor: { username: "alice" } },
          ],
        },
      },
    });

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    );

    expect(await screen.findByText("Meetings that did not happen")).toBeInTheDocument();
    expect(screen.getByText(/bella ↔ alice/)).toBeInTheDocument();
    expect(screen.getByText("Feedback outstanding for more than a week")).toBeInTheDocument();
    expect(screen.getByText(/carla/)).toBeInTheDocument();
    expect(screen.getByText("Mentors with more than 10 completed meetings")).toBeInTheDocument();
    expect(screen.getByText(/alice has completed 11 mentoring meetings/)).toBeInTheDocument();
  });

  it("shows a success message when there are no alerts", async () => {
    api.get.mockResolvedValue({
      data: {
        alerts: { meetingsNotCompleted: [], overdueFeedback: [], overloadedMentors: [] },
      },
    });

    render(
      <MemoryRouter>
        <Alerts />
      </MemoryRouter>
    );

    expect(await screen.findByText("No alerts right now.")).toBeInTheDocument();
  });
});
