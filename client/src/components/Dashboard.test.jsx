import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../api/client", () => ({ get: jest.fn() }));

function mockAuth(user) {
  useAuth.mockReturnValue({
    user,
    hasRole: (role) => user.roles.includes(role),
  });
}

describe("Dashboard", () => {
  afterEach(() => jest.resetAllMocks());

  it("warns mentors with a missing profile and offers a CTA", async () => {
    mockAuth({ username: "mentor1", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: null });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Your mentor profile is incomplete/i)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("link", { name: "Complete mentor profile" })
    ).toHaveAttribute("href", "/mentor-profile");
  });

  it("offers edit mentor profile when a profile already exists", async () => {
    mockAuth({ username: "mentor1", roles: ["mentor", "mentee"] });
    apiClient.get.mockResolvedValue({ data: { id: "p1" } });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Edit mentor profile" })).toBeInTheDocument()
    );
  });

  it("hides the Browse mentors CTA for mentor-only accounts", async () => {
    mockAuth({ username: "mentor1", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: { id: "p1" } });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Edit mentor profile" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("link", { name: /Browse mentors/ })).not.toBeInTheDocument();
  });

  it("shows the Browse mentors CTA for mentees", () => {
    mockAuth({ username: "mentee1", roles: ["mentee"] });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /Browse mentors/ })).toHaveAttribute("href", "/mentors");
  });
});
