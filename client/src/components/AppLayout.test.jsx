import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
      <MemoryRouter initialEntries={["/mentor-profile"]}>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Mentor Profile" })).toHaveAttribute(
      "href",
      "/mentor-profile"
    );
    await waitFor(() =>
      expect(apiClient.get).toHaveBeenCalledWith("/mentors/me")
    );
  });

  it("shows a complete-profile banner when mentor profile is missing", async () => {
    mockAuth({ username: "m", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: null });

    render(
      <MemoryRouter initialEntries={["/mentor-profile"]}>
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

  it("requires mentors to complete their profile before using the app", async () => {
    mockAuth({ username: "m", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: null });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div>Dashboard content</div>} />
          </Route>
          <Route path="/mentor-profile" element={<div>Complete setup</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Complete setup")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
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

  it("hides mentor discovery from mentor-only users", () => {
    mockAuth({ username: "m", roles: ["mentor"] });
    apiClient.get.mockResolvedValue({ data: { id: "p1" } });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Discover" })).not.toBeInTheDocument();
  });

  it("shows mentor discovery to users who are also mentees", () => {
    mockAuth({ username: "m", roles: ["mentor", "mentee"] });
    apiClient.get.mockResolvedValue({ data: { id: "p1" } });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("link", { name: "Discover" }).length).toBeGreaterThan(0);
  });

  it("uses the avatar as a profile link with user initials fallback", () => {
    mockAuth({ id: "u1", username: "queen bee", full_name: "", photo_url: "", roles: ["mentee"] });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Open profile" })).toHaveAttribute(
      "href",
      "/profile"
    );
    expect(screen.getByText("QB")).toBeInTheDocument();
  });

  it("allows switching to Hebrew and back to English", () => {
    mockAuth({ id: "u1", username: "e", roles: ["mentee"] });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("button", { name: "Switch language" })).toHaveTextContent("EN");

    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("button", { name: "Switch language" })).toHaveTextContent("HE");
  });
});
