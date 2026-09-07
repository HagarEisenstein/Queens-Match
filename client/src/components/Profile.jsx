import React, { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Profile() {
  const { user, updateProfile, hasRole } = useAuth();
  const displayName = user.full_name || user.username || "User";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    username: user.username || "",
    phone: user.phone || "",
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

  const resetFormFromUser = () => {
    setForm({
      username: user.username || "",
      phone: user.phone || "",
      full_name: user.full_name || "",
      job: user.job || "",
      workplace: user.workplace || "",
      years_experience: user.years_experience ?? "",
      tech_stack: (user.tech_stack || []).join(", "),
      github_url: user.github_url || "",
      linkedin_url: user.linkedin_url || "",
      photo_url: user.photo_url || "",
    });
  };

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
      setIsEditing(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message || "Unable to update profile."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isBoth = hasRole("mentor") && hasRole("mentee");
  const details = [
    { label: "Full name", value: user.full_name || "Not added yet" },
    { label: "Username", value: user.username || "Not added yet" },
    { label: "WhatsApp phone", value: user.phone || "Not added yet" },
    { label: "Job", value: user.job || "Not added yet" },
    { label: "Workplace", value: user.workplace || "Not added yet" },
    {
      label: "Years of experience",
      value:
        user.years_experience === null || user.years_experience === undefined
          ? "Not added yet"
          : String(user.years_experience),
    },
    {
      label: "Tech stack",
      value: user.tech_stack?.length ? user.tech_stack.join(", ") : "Not added yet",
    },
    { label: "GitHub URL", value: user.github_url || "Not added yet" },
    { label: "LinkedIn URL", value: user.linkedin_url || "Not added yet" },
    { label: "Photo URL", value: user.photo_url || "Not added yet" },
  ];

  return (
    <Box maxWidth="md" mx="auto">
      <Paper
        elevation={0}
        sx={{ p: 4, border: "1px solid", borderColor: "divider" }}
      >
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={user.photo_url || undefined}
                alt={displayName}
                sx={{ width: 72, height: 72, bgcolor: "primary.main", fontSize: 24 }}
              >
                {initials}
              </Avatar>
              <Box>
                <Typography variant="h4" color="primary">
                  Your profile
                </Typography>
                <Typography color="text.secondary">{user.email}</Typography>
              </Box>
            </Stack>
            <Button
              variant={isEditing ? "outlined" : "contained"}
              onClick={() => {
                setError("");
                setMessage("");
                setIsEditing((current) => {
                  const next = !current;
                  if (!next) {
                    resetFormFromUser();
                  }
                  return next;
                });
              }}
            >
              {isEditing ? "Cancel editing" : "Edit profile"}
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {isBoth ? (
              <>
                <Chip label="Mentoring" sx={{ bgcolor: "#FFD9E7" }} />
                <Chip label="Learning" color="secondary" variant="outlined" />
              </>
            ) : (
              user.roles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  sx={{ bgcolor: "#FFD9E7", textTransform: "capitalize" }}
                />
              ))
            )}
          </Stack>
          {hasRole("mentor") && (
            <Button
              component={Link}
              to="/mentor-profile"
              variant="outlined"
              color="secondary"
              sx={{ alignSelf: "flex-start" }}
            >
              Edit mentor profile
            </Button>
          )}
          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <Divider />
          {isEditing ? (
            <Stack component="form" spacing={2} onSubmit={submit}>
              <TextField label="Username" required value={form.username} onChange={setField("username")} />
              <TextField label="WhatsApp phone (+country code)" placeholder="+14155552671" value={form.phone} onChange={setField("phone")} />
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
          ) : (
            <Stack spacing={2}>
              {details.map((detail) => (
                <Box key={detail.label}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {detail.label}
                  </Typography>
                  <Typography>{detail.value}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
