import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RoleGuard from "./RoleGuard";
import { useAuth } from "../auth/AuthContext";

jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));

function renderWithGuard(roles, auth) {
  useAuth.mockReturnValue({
    ...auth,
    hasRole: (role) => (auth.user?.roles || []).includes(role),
  });

  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/login" element={<div>Login</div>} />
        <Route
          path="/protected"
          element={
            <RoleGuard roles={roles}>
              <div>Secret</div>
            </RoleGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RoleGuard", () => {
  afterEach(() => jest.resetAllMocks());

  it("renders children when the user has a required role", () => {
    renderWithGuard(["mentor"], {
      isAuthenticated: true,
      user: { roles: ["mentee", "mentor"] },
    });
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("redirects home when the role is missing", () => {
    renderWithGuard(["mentor"], {
      isAuthenticated: true,
      user: { roles: ["mentee"] },
    });
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", () => {
    renderWithGuard(["mentor"], {
      isAuthenticated: false,
      user: null,
    });
    expect(screen.getByText("Login")).toBeInTheDocument();
  });
});
