import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminInvites from "./AdminInvites";
import api from "../api";

jest.mock("../api", () => ({ post: jest.fn(), get: jest.fn() }));

describe("AdminInvites", () => {
  afterEach(() => jest.resetAllMocks());

  it("creates and displays an in-app invite with status", async () => {
    api.get.mockResolvedValue({ data: { invites: [] } });
    api.post.mockResolvedValue({
      data: {
        invite: {
          email: "new-admin@example.com",
          status: "pending",
          created_at: "2026-09-10T10:00:00.000Z",
        },
      },
    });

    render(
      <MemoryRouter>
        <AdminInvites />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText("Email"), "new-admin@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await screen.findByText(/Invitation sent to new-admin@example.com/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/admin/invites", { email: "new-admin@example.com" });
  });
});
