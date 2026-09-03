import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import MentorDetail from "./MentorDetail";
import apiClient from "../api/client";

jest.mock("../api/client");

const mentor = {
  id: "m1",
  background: "Ten years building backend systems.",
  adviceTopics: ["career planning", "mock interviews"],
  meetingsOffered: 1,
  meetingLengthMinutes: 30,
  user: { id: "u1", fullName: "Alice Admin", username: "alice", job: "Engineer", workplace: "Acme" },
};

function renderDetail(id = "m1") {
  return render(
    <MemoryRouter initialEntries={[`/mentors/${id}`]}>
      <Routes>
        <Route path="/mentors/:id" element={<MentorDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("MentorDetail", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows a loading indicator while the request is in flight", () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderDetail();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders the mentor's profile and a request-a-meeting call to action", async () => {
    apiClient.get.mockResolvedValue({ data: mentor });

    renderDetail("m1");

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Ten years building backend systems.")).toBeInTheDocument();
    expect(screen.getByText("career planning")).toBeInTheDocument();
    expect(screen.getByText("I offer 1 meeting, each 30 minutes long.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a meeting" })).toHaveAttribute(
      "href",
      "/meetings/new?mentorId=u1"
    );
    expect(apiClient.get).toHaveBeenCalledWith("/mentors/m1");
  });

  it("shows a not-found message on a 404 response", async () => {
    apiClient.get.mockRejectedValue({ response: { status: 404 } });

    renderDetail("missing");

    expect(await screen.findByText("Mentor profile not found.")).toBeInTheDocument();
  });

  it("shows a generic error message on other failures", async () => {
    apiClient.get.mockRejectedValue(new Error("network down"));

    renderDetail("m1");

    expect(await screen.findByText("Mentor profile could not be loaded.")).toBeInTheDocument();
  });
});
