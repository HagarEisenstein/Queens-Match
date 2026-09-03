import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RoleGuard({ roles = [], children }) {
  const { isAuthenticated, user } = useAuth();
  const allowed =
    roles.length === 0 ||
    roles.some((role) => user?.roles?.includes(role));

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to="/" replace />;
  return children;
}
