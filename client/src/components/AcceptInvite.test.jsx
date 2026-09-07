import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AcceptInvite from "./AcceptInvite";
import api from "../api";
import { useAuth } from "../auth/AuthContext";

jest.mock("../api", () => ({
  get: jest.fn(),
}));

jest.mock("../auth/AuthContext", () => ({
  useAuth: jest.fn(),
}));

describe("AcceptInvite", () => {
  afterEach(() => jest.resetAllMocks());

  it("loads invite details and submits the acceptance form", async () => {
    const acceptAdminInvite = jest.fn().mockResolvedValue({
      id: "u1",
      roles: ["admin"],
    });
    useAuth.mockReturnValue({
      isAuthenticated: false,
      acceptAdminInvite,
    });
    api.get.mockResolvedValue({
      data: {
        invite: {
          email: "new-admin@example.com",
          hasAccount: false,
          username: "",
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/accept-invite?token=test-token"]}>
        <Routes>
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/admin" element={<div>Admin landing</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByDisplayValue("new-admin@example.com")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Username"), "new-admin");
    await userEvent.type(screen.getByLabelText("Password"), "Strong!Pass9");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Strong!Pass9");
    await userEvent.click(screen.getByRole("button", { name: "Accept invite" }));

    await waitFor(() =>
      expect(acceptAdminInvite).toHaveBeenCalledWith({
        token: "test-token",
        username: "new-admin",
        password: "Strong!Pass9",
      })
    );
  });
});
