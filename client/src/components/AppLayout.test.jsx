import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppLayout from "./AppLayout";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../api/client", () => ({ get: jest.fn() }));
jest.mock("../notifications/NotificationBell", () => () => <div>bell</div>);

function mockAuth(user) {
  useAuth.mockReturnValue({
    user,
    logout: jest.fn(),
    hasRole: (role) => user.roles.includes(role),
  });
}

describe("AppLayout", () => {
  afterEach(() => jest.resetAllMocks());

  it("shows Mentor Profile nav for mentors", async () => {
    mockAuth({ username: "m", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: { id: "p1" } });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Mentor Profile" })).toHaveAttribute(
      "href",
      "/mentor-profile"
    );
  });

  it("shows a complete-profile banner when mentor profile is missing", async () => {
    mockAuth({ username: "m", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: null });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByText(/Complete mentor profile so mentees/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: "Complete mentor profile" })).toHaveAttribute(
      "href",
      "/mentor-profile"
    );
  });

  it("hides mentor nav for mentees", () => {
    mockAuth({ username: "e", roles: ["mentee"] });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Mentor Profile" })).not.toBeInTheDocument();
  });
});
