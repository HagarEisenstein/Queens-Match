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
import QueenBLogo from "./QueenBLogo";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const successMessage = location.state?.message;

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(form);
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

  return (
    <Box
      maxWidth="sm"
      mx="auto"
      mt={8}
      px={2}
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 8%, #FFD6E2 0%, #F8F8F6 42%, #F8F8F6 100%)",
      }}
    >
      <Box className="qm-bee" aria-hidden="true">
        <span className="qm-bee__trail" />
        <span className="qm-bee__wing qm-bee__wing--one" />
        <span className="qm-bee__wing qm-bee__wing--two" />
        <span className="qm-bee__body" />
        <span className="qm-bee__eye" />
      </Box>
      <Paper
        component="form"
        onSubmit={submit}
        elevation={0}
        sx={{ p: 4, border: "1px solid", borderColor: "divider", boxShadow: "6px 6px 0 rgba(32, 33, 36, .12)" }}
      >
        <Stack spacing={3}>
          <Box sx={{ alignSelf: "flex-start", pt: 1 }}>
            <QueenBLogo variant="wordmark" width={170} />
          </Box>
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
