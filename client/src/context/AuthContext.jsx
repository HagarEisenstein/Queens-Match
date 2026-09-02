import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem("queens-match-session")) || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  const value = useMemo(() => ({
    token: session?.token || null,
    user: session?.user || null,
    isAuthenticated: Boolean(session?.token),
    login(nextSession) {
      localStorage.setItem("queens-match-session", JSON.stringify(nextSession));
      setSession(nextSession);
    },
    logout() {
      localStorage.removeItem("queens-match-session");
      setSession(null);
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
