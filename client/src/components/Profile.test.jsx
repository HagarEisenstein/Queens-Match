import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Profile from "./Profile";
import { useAuth } from "../auth/AuthContext";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

function mockAuth(overrides = {}) {
  const updateProfile = jest.fn().mockResolvedValue({
    username: "queen",
    full_name: "Queen Bee",
  });

  useAuth.mockReturnValue({
    user: {
      email: "queen@example.com",
      username: "queen",
      full_name: "Queen Bee",
      job: "Engineer",
      workplace: "QueenB",
      years_experience: 5,
      tech_stack: ["React", "Node.js"],
      github_url: "https://github.com/queen",
      linkedin_url: "https://linkedin.com/in/queen",
      photo_url: "",
      roles: ["mentee", "mentor"],
      ...overrides.user,
    },
    updateProfile: overrides.updateProfile || updateProfile,
    hasRole: overrides.hasRole || ((role) => (overrides.user?.roles || ["mentee", "mentor"]).includes(role)),
  });

  return { updateProfile };
}

describe("Profile", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows a read-only profile view first and enters edit mode on demand", () => {
    mockAuth();

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    expect(screen.getByText("Queen Bee")).toBeInTheDocument();
    expect(screen.getByText("React, Node.js")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Username" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(screen.getByRole("textbox", { name: "Username" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeInTheDocument();
  });

  it("saves profile edits and returns to the profile view", async () => {
    const { updateProfile } = mockAuth();

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Job" }), {
      target: { value: "Senior Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ job: "Senior Engineer" })
      )
    );
    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
  });
});
