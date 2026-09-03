import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const initialForm = {
  email: "",
  username: "",
  password: "",
  full_name: "",
  job: "",
  workplace: "",
  years_experience: "",
  tech_stack: "",
  github_url: "",
  linkedin_url: "",
  photo_url: "",
  roles: ["mentee"],
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const toggleRole = (role) => {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((value) => value !== role)
        : [...current.roles, role],
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const optionalText = [
      "full_name",
      "job",
      "workplace",
      "github_url",
      "linkedin_url",
      "photo_url",
    ];
    const payload = {
      email: form.email,
      username: form.username,
      password: form.password,
      roles: form.roles,
      tech_stack: form.tech_stack
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    optionalText.forEach((field) => {
      if (form[field].trim()) payload[field] = form[field].trim();
    });
    if (form.years_experience !== "") {
      payload.years_experience = Number(form.years_experience);
    }

    try {
      await register(payload);
      navigate("/login", {
        replace: true,
        state: { message: "Registration complete. You can now log in." },
      });
    } catch (requestError) {
      const responseError = requestError.response?.data?.error;
      const details = responseError?.details
        ? Object.values(responseError.details).flat().join(" ")
        : "";
      setError(
        [responseError?.message, details].filter(Boolean).join(" ") ||
          "Unable to register."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth="md" mx="auto" my={5}>
      <Paper component="form" onSubmit={submit} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">Create your account</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" required value={form.email} onChange={setField("email")} />
          <TextField label="Username" required value={form.username} onChange={setField("username")} />
          <TextField
            label="Password"
            type="password"
            required
            helperText="Use 8+ characters with uppercase, lowercase, number, and special character."
            value={form.password}
            onChange={setField("password")}
          />
          <Typography variant="subtitle1">Account capabilities</Typography>
          <FormGroup row>
            {["mentee", "mentor"].map((role) => (
              <FormControlLabel
                key={role}
                control={
                  <Checkbox
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                }
                label={role}
              />
            ))}
          </FormGroup>
          <TextField label="Full name (optional)" value={form.full_name} onChange={setField("full_name")} />
          <TextField label="Job (optional)" value={form.job} onChange={setField("job")} />
          <TextField label="Workplace (optional)" value={form.workplace} onChange={setField("workplace")} />
          <TextField
            label="Years of experience (optional)"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={form.years_experience}
            onChange={setField("years_experience")}
          />
          <TextField
            label="Tech stack (optional)"
            helperText="Comma-separated, for example: React, Node.js, PostgreSQL"
            value={form.tech_stack}
            onChange={setField("tech_stack")}
          />
          <TextField label="GitHub URL (optional)" type="url" value={form.github_url} onChange={setField("github_url")} />
          <TextField label="LinkedIn URL (optional)" type="url" value={form.linkedin_url} onChange={setField("linkedin_url")} />
          <TextField label="Photo URL (optional)" type="url" value={form.photo_url} onChange={setField("photo_url")} />
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || form.roles.length === 0}
          >
            {submitting ? "Creating account…" : "Register"}
          </Button>
          <Typography>
            Already registered?{" "}
            <MuiLink component={Link} to="/login">
              Log in
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
