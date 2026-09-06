import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MentorSearchAssistant from "./MentorSearchAssistant";

describe("MentorSearchAssistant", () => {
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

  it("stores the entered text locally and submits without making a request", async () => {
    const user = userEvent.setup();
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

    expect(input).toHaveValue("Help with backend interviews");
    expect(screen.getByText("Find your mentor")).toBeInTheDocument();
  });
});
