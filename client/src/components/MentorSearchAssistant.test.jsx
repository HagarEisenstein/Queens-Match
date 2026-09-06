import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MentorSearchAssistant from "./MentorSearchAssistant";
import { searchMentorsBySemanticQuery } from "../api/client";

jest.mock("../api/client", () => ({
  searchMentorsBySemanticQuery: jest.fn(),
}));

const semanticMentor = {
  id: "m1",
  background: "Backend engineer and interview coach",
  adviceTopics: ["Backend Development", "CV / Resume Review"],
  meetingsOffered: 3,
  meetingLengthMinutes: 45,
  user: {
    id: "u1",
    username: "ada",
    fullName: "Ada Mentor",
    photoUrl: null,
    job: "Staff Engineer",
    workplace: "QueenB",
    techStack: ["Node.js", "PostgreSQL"],
  },
  semanticScore: 0.875,
};

function renderAssistant() {
  return render(
    <MemoryRouter>
      <MentorSearchAssistant />
    </MemoryRouter>
  );
}

describe("MentorSearchAssistant", () => {
  beforeEach(() => {
    searchMentorsBySemanticQuery.mockReset();
  });

  it("opens and closes the mentor search panel", async () => {
    const user = userEvent.setup();
    renderAssistant();

    expect(screen.queryByText("Find your mentor")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Help me find a mentor" })
    );

    expect(screen.getByText("Find your mentor")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Describe what kind of help you’re looking for, and we’ll use it to find relevant mentors."
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close mentor search" }));

    await waitFor(() =>
      expect(screen.queryByText("Find your mentor")).not.toBeInTheDocument()
    );
  });

  it("posts the entered text and renders ranked semantic mentor matches", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    searchMentorsBySemanticQuery.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    renderAssistant();

    await user.click(
      screen.getByRole("button", { name: "Help me find a mentor" })
    );

    const input = screen.getByRole("textbox", {
      name: "What kind of help do you need?",
    });
    const submitButton = screen.getByRole("button", { name: "Find mentors" });

    expect(input).toHaveAttribute(
      "placeholder",
      "I’m looking for someone who can help me prepare for a backend interview and review my CV"
    );
    expect(submitButton).toBeDisabled();

    await user.type(input, "Help with backend interviews");
    expect(input).toHaveValue("Help with backend interviews");
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    expect(searchMentorsBySemanticQuery).toHaveBeenCalledWith(
      "Help with backend interviews"
    );
    expect(submitButton).toBeDisabled();
    expect(
      screen.getByRole("progressbar", { name: "Searching for mentors" })
    ).toBeInTheDocument();

    resolveRequest({ data: { mentors: [semanticMentor] } });

    expect(await screen.findByText("Ada Mentor")).toBeInTheDocument();
    expect(screen.getByText("Backend engineer and interview coach")).toBeInTheDocument();
    expect(screen.getByText("88% semantic match")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Ada Mentor's profile" })).toHaveAttribute(
      "href",
      "/mentors/m1"
    );
    expect(input).toHaveValue("Help with backend interviews");
    expect(screen.getByText("Find your mentor")).toBeInTheDocument();
  });

  it("shows an empty result state when no stored mentor embeddings match", async () => {
    const user = userEvent.setup();
    searchMentorsBySemanticQuery.mockResolvedValue({ data: { mentors: [] } });
    renderAssistant();

    await user.click(
      screen.getByRole("button", { name: "Help me find a mentor" })
    );
    await user.type(
      screen.getByRole("textbox", { name: "What kind of help do you need?" }),
      "Quantum mentorship"
    );
    await user.click(screen.getByRole("button", { name: "Find mentors" }));

    expect(
      await screen.findByText("No semantic mentor matches are available yet.")
    ).toBeInTheDocument();
  });

  it("shows a friendly error and preserves the entered text", async () => {
    const user = userEvent.setup();
    searchMentorsBySemanticQuery.mockRejectedValue(new Error("network down"));
    renderAssistant();

    await user.click(
      screen.getByRole("button", { name: "Help me find a mentor" })
    );
    const input = screen.getByRole("textbox", {
      name: "What kind of help do you need?",
    });
    await user.type(input, "Help with my CV");
    await user.click(screen.getByRole("button", { name: "Find mentors" }));

    expect(
      await screen.findByText(
        "We couldn’t find mentors right now. Please try again."
      )
    ).toBeInTheDocument();
    expect(input).toHaveValue("Help with my CV");
  });
});
