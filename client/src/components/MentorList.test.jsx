import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MentorList from "./MentorList";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./MentorSearchAssistant", () => () => null);

const mentor = {
  id: "m1",
  background: "Ten years building backend systems.",
  adviceTopics: ["CV / Resume Review", "Technical Mock Interviews"],
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
    apiClient.get.mockReturnValue(new Promise(() => {}));

    renderList();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /filter by advice topic/i })).toBeInTheDocument();
  });

  it("renders each mentor's details once the list loads", async () => {
    apiClient.get.mockResolvedValue({ data: [mentor] });

    renderList();

    expect(await screen.findByText("Alice Admin")).toBeInTheDocument();
    expect(screen.getByText("Engineer · Acme")).toBeInTheDocument();
    expect(screen.getAllByText("CV / Resume Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Technical Mock Interviews").length).toBeGreaterThan(0);
    expect(screen.getByText("2 meetings · 45 minutes each")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/mentors/m1");
    expect(apiClient.get).toHaveBeenCalledWith("/mentors");
  });

  it("shows an empty state when there are no mentors yet", async () => {
    apiClient.get.mockResolvedValue({ data: [] });

    renderList();

    expect(await screen.findByText("No mentor profiles are available yet.")).toBeInTheDocument();
  });

  it("does not offer the signed-in user's own mentor profile", async () => {
    apiClient.get.mockResolvedValue({
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

  it("filters mentors by the selected advice topics", async () => {
    const user = userEvent.setup();
    apiClient.get.mockResolvedValue({
      data: [
        mentor,
        {
          ...mentor,
          id: "m2",
          adviceTopics: ["System Design Interviews"],
          user: { ...mentor.user, id: "u2", fullName: "Bella Mentor" },
        },
      ],
    });

    renderList();
    await screen.findByText("Alice Admin");

    await user.click(screen.getByRole("checkbox", { name: "System Design Interviews" }));

    expect(await screen.findByText("Bella Mentor")).toBeInTheDocument();
    expect(screen.queryByText("Alice Admin")).not.toBeInTheDocument();
  });

  it("shows an empty filter state when no mentors match", async () => {
    const user = userEvent.setup();
    apiClient.get.mockResolvedValue({ data: [mentor] });

    renderList();
    await screen.findByText("Alice Admin");

    await user.click(screen.getByRole("checkbox", { name: "System Design Interviews" }));

    expect(
      await screen.findByText("No mentors match the selected topics.")
    ).toBeInTheDocument();
  });
});
