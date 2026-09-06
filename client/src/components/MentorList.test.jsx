import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MentorList from "./MentorList";
import { getMentors } from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ getMentors: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

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
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { id: "current-user" } });
  });

  afterEach(() => jest.resetAllMocks());

  it("shows a loading indicator while the request is in flight", () => {
    getMentors.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders each mentor's details once the list loads", async () => {
    getMentors.mockResolvedValue({ data: [mentor] });

    renderList();

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Engineer · Acme")).toBeInTheDocument();
    expect(screen.getByText("career planning")).toBeInTheDocument();
    expect(screen.getByText("mock interviews")).toBeInTheDocument();
    expect(screen.getByText("2 meetings · 45 minutes each")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/mentors/m1");
    expect(getMentors).toHaveBeenCalledWith([]);
  });

  it("shows an empty state when there are no mentors yet", async () => {
    getMentors.mockResolvedValue({ data: [] });

    renderList();

    expect(await screen.findByText("No mentor profiles are available yet.")).toBeInTheDocument();
  });

  it("does not offer the signed-in user's own mentor profile", async () => {
    getMentors.mockResolvedValue({
      data: [
        { ...mentor, user: { ...mentor.user, id: "current-user" } },
        { ...mentor, id: "m2", user: { ...mentor.user, id: "u2", fullName: "Bella Mentor" } },
      ],
    });

    renderList();

    expect(await screen.findByText("Bella Mentor")).toBeInTheDocument();
    expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    getMentors.mockRejectedValue(new Error("network down"));

    renderList();

    expect(await screen.findByText("Mentors could not be loaded.")).toBeInTheDocument();
  });

  it("falls back to the username when no full name is set", async () => {
    const noName = { ...mentor, user: { ...mentor.user, fullName: null } };
    getMentors.mockResolvedValue({ data: [noName] });

    renderList();

    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());
  });

  it("refetches mentors with every selected advice topic", async () => {
    const user = userEvent.setup();
    getMentors.mockResolvedValue({ data: [mentor] });

    renderList();
    await screen.findByText("Alice Admin");

    await user.click(screen.getByRole("checkbox", { name: "CV / Resume Review" }));
    await waitFor(() =>
      expect(getMentors).toHaveBeenLastCalledWith(["CV / Resume Review"])
    );

    await user.click(
      screen.getByRole("checkbox", { name: "System Design Interviews" })
    );
    await waitFor(() =>
      expect(getMentors).toHaveBeenLastCalledWith([
        "CV / Resume Review",
        "System Design Interviews",
      ])
    );
  });

  it("falls back to the unfiltered request after clearing the selected topics", async () => {
    const user = userEvent.setup();
    getMentors.mockResolvedValue({ data: [mentor] });

    renderList();
    await screen.findByText("Alice Admin");

    const topicCheckbox = screen.getByRole("checkbox", {
      name: "Technical Mock Interviews",
    });
    await user.click(topicCheckbox);
    await waitFor(() =>
      expect(getMentors).toHaveBeenLastCalledWith(["Technical Mock Interviews"])
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(getMentors).toHaveBeenLastCalledWith([]));
  });
});
