import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MentorList from "./MentorList";
import apiClient from "../api/client";

jest.mock("../api/client");

const mentor = {
  id: "m1",
  background: "Ten years building backend systems.",
  adviceTopics: ["career planning", "mock interviews"],
  meetingsOffered: 2,
  meetingLengthMinutes: 45,
  user: { id: "u1", fullName: "Alice Admin", username: "alice", job: "Engineer", workplace: "Acme" },
};

function renderList() {
  return render(
    <MemoryRouter>
      <MentorList />
    </MemoryRouter>
  );
}

describe("MentorList", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows a loading indicator while the request is in flight", () => {
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders each mentor's details once the list loads", async () => {
    apiClient.get.mockResolvedValue({ data: [mentor] });

    renderList();

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Engineer · Acme")).toBeInTheDocument();
    expect(screen.getByText("career planning")).toBeInTheDocument();
    expect(screen.getByText("mock interviews")).toBeInTheDocument();
    expect(screen.getByText("2 meetings · 45 minutes each")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/mentors/m1");
    expect(apiClient.get).toHaveBeenCalledWith("/mentors");
  });

  it("shows an empty state when there are no mentors yet", async () => {
    apiClient.get.mockResolvedValue({ data: [] });

    renderList();

    expect(await screen.findByText("No mentor profiles are available yet.")).toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    apiClient.get.mockRejectedValue(new Error("network down"));

    renderList();

    expect(await screen.findByText("Mentors could not be loaded.")).toBeInTheDocument();
  });

  it("falls back to the username when no full name is set", async () => {
    const noName = { ...mentor, user: { ...mentor.user, fullName: null } };
    apiClient.get.mockResolvedValue({ data: [noName] });

    renderList();

    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());
  });
});
