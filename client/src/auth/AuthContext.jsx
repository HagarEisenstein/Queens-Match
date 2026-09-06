import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "queenb_token";
const USER_KEY = "queenb_user";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const saveSession = useCallback((session) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/users/profile");
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    api
      .get("/users/profile")
      .then(({ data }) => {
        if (!active) return;
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, clearSession]);

  const login = useCallback(
    async (credentials) => {
      const { data } = await api.post("/auth/login", credentials);
      saveSession(data);
      return data.user;
    },
    [saveSession]
  );

  const register = useCallback(
    async (registration) => {
      const { data } = await api.post("/auth/register", registration);
      saveSession(data);
      return data.user;
    },
    [saveSession]
  );

  const acceptAdminInvite = useCallback(
    async (payload) => {
      const { data } = await api.post("/auth/accept-invite", payload);
      saveSession(data);
      return data.user;
    },
    [saveSession]
  );

  const updateProfile = useCallback(async (profile) => {
    const { data } = await api.put("/users/profile", profile);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    navigate("/login", { replace: true });
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      hasRole: (role) => Boolean(user?.roles?.includes(role)),
      login,
      register,
      acceptAdminInvite,
      logout,
      updateProfile,
      refreshUser,
    }),
    [token, user, loading, login, register, acceptAdminInvite, logout, updateProfile, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
