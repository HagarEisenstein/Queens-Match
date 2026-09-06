import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MentorProfile from "./MentorProfile";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api/client", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const existingProfile = {
  background: "Ten years building backend systems.",
  adviceTopics: ["CV / Resume Review", "Technical Mock Interviews"],
  meetingsOffered: 2,
  meetingLengthMinutes: 45,
};

// MUI marks required fields with a trailing " *" inside the <label>, so an
// exact label match ("Background") never hits — every field here is required.
const field = (text) => screen.getByLabelText(text, { exact: false });
const findField = (text) => screen.findByLabelText(text, { exact: false });
const topicInput = () => screen.getByRole("combobox", { name: /advice topics/i });

// Pick a built-in advice topic from the Autocomplete dropdown by name.
const pickTopic = (topic) => {
  const input = topicInput();
  fireEvent.change(input, { target: { value: topic } });
  fireEvent.click(screen.getByRole("option", { name: topic }));
};

// Type a custom free-text advice topic and commit it with Enter.
const addCustomTopic = (topic) => {
  const input = topicInput();
  fireEvent.change(input, { target: { value: topic } });
  fireEvent.keyDown(input, { key: "Enter" });
};

describe("MentorProfile", () => {
  const refreshUser = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    useAuth.mockReturnValue({
      refreshUser,
      user: { roles: ["mentor"] },
      hasRole: (role) => ["mentor"].includes(role),
    });
  });

  afterEach(() => jest.resetAllMocks());

  it("shows an error state when the existing profile cannot be loaded", async () => {
    apiClient.get.mockRejectedValue(new Error("network down"));

    render(<MentorProfile />);

    expect(await screen.findByText("Your profile could not be loaded.")).toBeInTheDocument();
  });

  it("prefills the form with an existing profile, showing selected topics as chips", async () => {
    apiClient.get.mockResolvedValue({ data: existingProfile });

    render(<MentorProfile />);

    expect(await findField("Background")).toHaveValue(existingProfile.background);
    existingProfile.adviceTopics.forEach((topic) => {
      expect(screen.getByText(topic)).toBeInTheDocument();
    });
    expect(field("Meetings offered")).toHaveValue(2);
    expect(field("Length of each meeting (minutes)")).toHaveValue(45);
  });

  it("starts blank when the mentee has no mentor profile yet", async () => {
    apiClient.get.mockResolvedValue({ data: null });

    render(<MentorProfile />);

    expect(await findField("Background")).toHaveValue("");
    expect(field("Meetings offered")).toHaveValue(1);
    expect(apiClient.get).toHaveBeenCalledWith("/mentors/me");
  });

  it("submits the selected topics as an array and shows a success message", async () => {
    apiClient.get.mockResolvedValue({ data: null });
    apiClient.put.mockResolvedValue({ data: { ...existingProfile } });

    render(<MentorProfile />);
    await findField("Background");

    fireEvent.change(field("Background"), { target: { value: "New background text." } });
    pickTopic("CV / Resume Review");
    pickTopic("Technical Mock Interviews");
    fireEvent.change(field("Meetings offered"), { target: { value: "3" } });
    fireEvent.change(field("Length of each meeting (minutes)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith("/mentors/me", {
        background: "New background text.",
        adviceTopics: ["CV / Resume Review", "Technical Mock Interviews"],
        meetingsOffered: 3,
        meetingLengthMinutes: 60,
      })
    );
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(await screen.findByText("Mentor profile saved.")).toBeInTheDocument();
  });

  it("lets a mentor add a custom free-text topic alongside a built-in one", async () => {
    apiClient.get.mockResolvedValue({ data: null });
    apiClient.put.mockResolvedValue({ data: { ...existingProfile } });

    render(<MentorProfile />);
    await findField("Background");

    fireEvent.change(field("Background"), { target: { value: "New background text." } });
    pickTopic("CV / Resume Review");
    addCustomTopic("Kubernetes deep dives");
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith(
        "/mentors/me",
        expect.objectContaining({
          adviceTopics: ["CV / Resume Review", "Kubernetes deep dives"],
        })
      )
    );
    expect(await screen.findByText("Mentor profile saved.")).toBeInTheDocument();
  });

  it("blocks saving and warns when no topic is selected", async () => {
    apiClient.get.mockResolvedValue({ data: null });

    render(<MentorProfile />);
    await findField("Background");

    fireEvent.change(field("Background"), { target: { value: "New background text." } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("Please select at least one advice topic.")
    ).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it("shows the server's error message when saving fails", async () => {
    apiClient.get.mockResolvedValue({ data: existingProfile });
    apiClient.put.mockRejectedValue({
      response: { data: { error: { message: "Background is required." } } },
    });

    render(<MentorProfile />);
    await findField("Background");

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Background is required.")).toBeInTheDocument();
  });
});
