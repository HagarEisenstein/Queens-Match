import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeetingsReport from "./MeetingsReport";
import api from "../api";
import { downloadMeetingsExcel } from "./meetingsReportExport";

jest.mock("../api", () => ({ get: jest.fn() }));
jest.mock("./meetingsReportExport", () => ({ downloadMeetingsExcel: jest.fn() }));

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

  it("exports the exact meetings returned for the current filters", async () => {
    const outsideCurrentFilter = {
      ...meeting,
      id: "m2",
      status: "scheduled",
      mentee: { username: "carol" },
    };
    api.get.mockImplementation((path, options = {}) => {
      if (path === "/admin/users") return Promise.resolve({ data: { users: [] } });
      const isCompletedFilter = options.params?.status === "completed";
      return Promise.resolve({
        data: { meetings: isCompletedFilter ? [meeting] : [meeting, outsideCurrentFilter] },
      });
    });

    render(
      <MemoryRouter>
        <MeetingsReport />
      </MemoryRouter>
    );

    await screen.findByText("carol");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Completed" }));
    await waitFor(() => expect(screen.queryByText("carol")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Download Excel" }));
    expect(downloadMeetingsExcel).toHaveBeenCalledWith([meeting]);
  });
});
