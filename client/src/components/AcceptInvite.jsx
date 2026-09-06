import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth/AuthContext";

export default function AcceptInvite() {
  const { isAuthenticated, acceptAdminInvite } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Invite token is missing.");
      return;
    }

    let active = true;
    setLoading(true);
    api
      .get("/auth/accept-invite", { params: { token } })
      .then(({ data }) => {
        if (!active) return;
        setInvite(data.invite);
        setForm((current) => ({ ...current, username: data.invite.username || "" }));
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.error?.message ||
            "This invite is invalid or has expired."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (isAuthenticated && !token) {
    return <Navigate to="/" replace />;
  }

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await acceptAdminInvite({
        token,
        username: invite?.hasAccount ? undefined : form.username,
        password: form.password,
      });
      navigate("/admin", {
        replace: true,
        state: { message: "Your admin invite has been accepted." },
      });
    } catch (requestError) {
      const responseError = requestError.response?.data?.error;
      const details = responseError?.details
        ? Object.values(responseError.details).flat().join(" ")
        : "";
      setError(
        [responseError?.message, details].filter(Boolean).join(" ") ||
          "Invite could not be accepted."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth="sm" mx="auto" mt={8} px={2}>
      <Paper component="form" onSubmit={submit} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">Accept admin invite</Typography>
          {loading && <Alert severity="info">Checking your invite…</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {invite && (
            <Alert severity="success">
              You are accepting an admin invite for {invite.email}.
            </Alert>
          )}
          <TextField
            label="Email"
            value={invite?.email || ""}
            InputProps={{ readOnly: true }}
          />
          {!invite?.hasAccount && (
            <TextField
              label="Username"
              required
              value={form.username}
              onChange={setField("username")}
            />
          )}
          {invite?.hasAccount && (
            <TextField
              label="Username"
              value={form.username}
              InputProps={{ readOnly: true }}
            />
          )}
          <TextField
            label="Password"
            type="password"
            required
            helperText="Use 8+ characters with uppercase, lowercase, number, and special character."
            value={form.password}
            onChange={setField("password")}
          />
          <TextField
            label="Confirm password"
            type="password"
            required
            value={form.confirmPassword}
            onChange={setField("confirmPassword")}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !invite || submitting}
          >
            {submitting ? "Accepting invite…" : "Accept invite"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
