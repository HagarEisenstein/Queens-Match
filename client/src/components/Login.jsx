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
      setError(
        requestError.response?.data?.error?.message || "Unable to log in."
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
          "radial-gradient(circle at top, #FFD9E7 0%, #FFF0F6 40%, #FFFFFF 100%)",
      }}
    >
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
