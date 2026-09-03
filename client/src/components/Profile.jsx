import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../auth/AuthContext";

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    username: user.username || "",
    full_name: user.full_name || "",
    job: user.job || "",
    workplace: user.workplace || "",
    years_experience: user.years_experience ?? "",
    tech_stack: (user.tech_stack || []).join(", "),
    github_url: user.github_url || "",
    linkedin_url: user.linkedin_url || "",
    photo_url: user.photo_url || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    const payload = {
      ...form,
      full_name: form.full_name || null,
      job: form.job || null,
      workplace: form.workplace || null,
      github_url: form.github_url || null,
      linkedin_url: form.linkedin_url || null,
      photo_url: form.photo_url || null,
      years_experience:
        form.years_experience === "" ? null : Number(form.years_experience),
      tech_stack: form.tech_stack
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      await updateProfile(payload);
      setMessage("Profile updated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || "Unable to update profile."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth="md" mx="auto">
      <Paper component="form" onSubmit={submit} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h4">Your profile</Typography>
          <Typography color="text.secondary">{user.email}</Typography>
          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Username" required value={form.username} onChange={setField("username")} />
          <TextField label="Full name" value={form.full_name} onChange={setField("full_name")} />
          <TextField label="Job" value={form.job} onChange={setField("job")} />
          <TextField label="Workplace" value={form.workplace} onChange={setField("workplace")} />
          <TextField
            label="Years of experience"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={form.years_experience}
            onChange={setField("years_experience")}
          />
          <TextField label="Tech stack" value={form.tech_stack} onChange={setField("tech_stack")} />
          <TextField label="GitHub URL" type="url" value={form.github_url} onChange={setField("github_url")} />
          <TextField label="LinkedIn URL" type="url" value={form.linkedin_url} onChange={setField("linkedin_url")} />
          <TextField label="Photo URL" type="url" value={form.photo_url} onChange={setField("photo_url")} />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Saving…" : "Save profile"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
