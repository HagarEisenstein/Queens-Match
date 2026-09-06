import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MentorSearchAssistant from "./MentorSearchAssistant";
import { verifyMentorSearchEmbedding } from "../api/client";

jest.mock("../api/client", () => ({
  verifyMentorSearchEmbedding: jest.fn(),
}));

describe("MentorSearchAssistant", () => {
  beforeEach(() => {
    verifyMentorSearchEmbedding.mockReset();
  });

  it("opens and closes the mentor search panel", async () => {
    const user = userEvent.setup();
    render(<MentorSearchAssistant />);

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

  it("posts the entered text and shows loading and success states", async () => {
    const user = userEvent.setup();
    let resolveRequest;
    verifyMentorSearchEmbedding.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );
    render(<MentorSearchAssistant />);

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

    expect(verifyMentorSearchEmbedding).toHaveBeenCalledWith(
      "Help with backend interviews"
    );
    expect(submitButton).toBeDisabled();
    expect(
      screen.getByRole("progressbar", { name: "Understanding search" })
    ).toBeInTheDocument();

    resolveRequest({ data: { ok: true, dimension: 3072 } });

    expect(
      await screen.findByText("Search understanding is working")
    ).toBeInTheDocument();
    expect(input).toHaveValue("Help with backend interviews");
    expect(screen.getByText("Find your mentor")).toBeInTheDocument();
  });

  it("shows a friendly error and preserves the entered text", async () => {
    const user = userEvent.setup();
    verifyMentorSearchEmbedding.mockRejectedValue(new Error("network down"));
    render(<MentorSearchAssistant />);

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
        "We couldn’t understand your search right now. Please try again."
      )
    ).toBeInTheDocument();
    expect(input).toHaveValue("Help with my CV");
  });
});
