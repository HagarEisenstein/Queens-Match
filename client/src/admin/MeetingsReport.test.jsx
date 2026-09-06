import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeetingsReport from "./MeetingsReport";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn() }));

const meeting = {
  id: "m1",
  status: "scheduled",
  scheduledTime: "2026-09-04T10:00:00.000Z",
  mentee: { username: "bella" },
  mentor: { username: "alice" },
};

describe("MeetingsReport", () => {
  afterEach(() => jest.resetAllMocks());

  it("renders a filterable meetings table", async () => {
    api.get.mockImplementation((path) => {
      if (path === "/admin/users") {
        return Promise.resolve({ data: { users: [{ id: "u1", username: "alice", email: "a@x.com" }] } });
      }
      return Promise.resolve({ data: { meetings: [meeting] } });
    });

    render(
      <MemoryRouter>
        <MeetingsReport />
      </MemoryRouter>
    );

    expect(await screen.findByText("bella")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "bella" })).toHaveAttribute(
      "href",
      "/admin/meetings/m1"
    );
  });
});
