import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import LocaleToggle from "./LocaleToggle";

const DEMO_ADMIN_EMAIL = "admin@queensmatch.local";
const DEMO_ADMIN_PASSWORD = "Admin123!";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const successMessage = location.state?.message;

  if (isAuthenticated) return <Navigate to="/" replace />;

  const loginWithCredentials = async (credentials) => {
    setSubmitting(true);
    setError("");
    try {
      await login(credentials);
      navigate("/", { replace: true });
    } catch (requestError) {
      const apiError = requestError.response?.data?.error;
      const databaseUnavailable =
        apiError?.code === "ECONNREFUSED" || apiError?.code === "DATABASE_ERROR";
      setError(
        databaseUnavailable
          ? "The demo service cannot reach its database. Start PostgreSQL and the API, then try again."
          : apiError?.message || "Unable to log in."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    await loginWithCredentials(form);
  };

  const loginAsDemoAdmin = async () => {
    await loginWithCredentials({
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
    });
  };

  return (
    <Box
      maxWidth="sm"
      mx="auto"
      mt={8}
      px={2}
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #FFD9E7 0%, #FFF0F6 40%, #FFFFFF 100%)",
      }}
    >
      <Box className="qm-bee" aria-hidden="true">
        <span className="qm-bee__trail" />
        <span className="qm-bee__wing qm-bee__wing--one" />
        <span className="qm-bee__wing qm-bee__wing--two" />
        <span className="qm-bee__body" />
        <span className="qm-bee__eye" />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", py: 2 }}>
        <LocaleToggle />
      </Box>
      <Paper
        component="form"
        onSubmit={submit}
        elevation={0}
        sx={{ p: 4, border: "1px solid", borderColor: "divider" }}
      >
        <Stack spacing={3}>
          <Typography
            variant="h3"
            color="primary"
            sx={{ fontFamily: '"Sunday", "Fredoka", "Nunito", sans-serif' }}
          >
            Queens Match
          </Typography>
          <Typography variant="h4">Log in</Typography>
          {successMessage && <Alert severity="success">{successMessage}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="large"
            onClick={loginAsDemoAdmin}
            disabled={submitting}
          >
            Login as admin (demo)
          </Button>
          <Typography variant="caption" color="text.secondary">
            Demo account for local presentation only: {DEMO_ADMIN_EMAIL}
          </Typography>
          <Typography>
            Need an account?{" "}
            <MuiLink component={Link} to="/register" color="secondary">
              Register
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
