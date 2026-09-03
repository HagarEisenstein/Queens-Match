import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MentorProfile from "./MentorProfile";
import apiClient from "../api/client";

jest.mock("../api/client", () => ({ get: jest.fn(), put: jest.fn() }));

const existingProfile = {
  background: "Ten years building backend systems.",
  adviceTopics: ["career planning", "mock interviews"],
  meetingsOffered: 2,
  meetingLengthMinutes: 45,
};

// MUI marks required fields with a trailing " *" inside the <label>, so an
// exact label match ("Background") never hits — every field here is required.
const field = (text) => screen.getByLabelText(text, { exact: false });
const findField = (text) => screen.findByLabelText(text, { exact: false });

describe("MentorProfile", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows an error state when the existing profile cannot be loaded", async () => {
    apiClient.get.mockRejectedValue(new Error("network down"));

    render(<MentorProfile />);

    expect(await screen.findByText("Your profile could not be loaded.")).toBeInTheDocument();
  });

  it("prefills the form with an existing profile, joining topics with commas", async () => {
    apiClient.get.mockResolvedValue({ data: existingProfile });

    render(<MentorProfile />);

    expect(await findField("Background")).toHaveValue(existingProfile.background);
    expect(field("Advice topics")).toHaveValue("career planning, mock interviews");
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

  it("submits comma-separated topics as a trimmed array and shows a success message", async () => {
    apiClient.get.mockResolvedValue({ data: null });
    apiClient.put.mockResolvedValue({ data: { ...existingProfile } });

    render(<MentorProfile />);
    await findField("Background");

    fireEvent.change(field("Background"), { target: { value: "New background text." } });
    fireEvent.change(field("Advice topics"), {
      target: { value: " career planning ,  mock interviews," },
    });
    fireEvent.change(field("Meetings offered"), { target: { value: "3" } });
    fireEvent.change(field("Length of each meeting (minutes)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(apiClient.put).toHaveBeenCalledWith("/mentors/me", {
        background: "New background text.",
        adviceTopics: ["career planning", "mock interviews"],
        meetingsOffered: 3,
        meetingLengthMinutes: 60,
      })
    );
    expect(await screen.findByText("Mentor profile saved.")).toBeInTheDocument();
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
