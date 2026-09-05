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
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import LocaleToggle from "./LocaleToggle";

const initialForm = {
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
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

const roleOptions = [
  {
    id: "mentor",
    title: "Mentor",
    blurb: "Offer guidance and open your profile to mentees.",
  },
  {
    id: "both",
    title: "Both",
    blurb: "Mentor in one area and learn in another — celebrated here.",
    accent: true,
  },
  {
    id: "mentee",
    title: "Mentee",
    blurb: "Looking for support matched to your goals.",
  },
];

function rolesFromChoice(choiceId) {
  if (choiceId === "both") return ["mentee", "mentor"];
  if (choiceId === "mentor") return ["mentor"];
  return ["mentee"];
}

function selectedChoice(roles) {
  const hasMentor = roles.includes("mentor");
  const hasMentee = roles.includes("mentee");
  if (hasMentor && hasMentee) return "both";
  if (hasMentor) return "mentor";
  return "mentee";
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const pickRole = (choiceId) => {
    setForm((current) => ({
      ...current,
      roles: rolesFromChoice(choiceId),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
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
      const registeredUser = await register(payload);
      navigate(
        registeredUser.roles.includes("mentor") ? "/mentor-profile" : "/",
        { replace: true }
      );
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

  const activeChoice = selectedChoice(form.roles);

  return (
    <Box
      maxWidth="md"
      mx="auto"
      my={5}
      px={2}
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #FFD9E7 0%, #FFF0F6 45%, #FFFFFF 100%)",
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
      <Paper component="form" onSubmit={submit} elevation={0} sx={{ p: { xs: 3, md: 4 }, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={3}>
          <Typography
            variant="h3"
            color="primary"
            sx={{ fontFamily: '"Sunday", "Fredoka", "Nunito", sans-serif' }}
          >
            Queens Match
          </Typography>
          <Typography variant="h4">Create your account</Typography>
          <Typography color="text.secondary">
            How do you want to show up?
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            role="group"
            aria-label="Account capabilities"
          >
            {roleOptions.map((option) => {
              const selected = activeChoice === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  onClick={() => pickRole(option.id)}
                  variant={selected ? "contained" : "outlined"}
                  color={option.accent && !selected ? "secondary" : "primary"}
                  sx={{
                    flex: 1,
                    flexDirection: "column",
                    alignItems: "flex-start",
                    textAlign: "start",
                    py: 2.5,
                    px: 2,
                    borderRadius: "16px",
                    borderWidth: 2,
                    boxShadow: selected
                      ? "0 10px 24px rgba(255, 125, 156, 0.25)"
                      : "none",
                    bgcolor: selected
                      ? "primary.main"
                      : option.accent
                        ? "rgba(113, 92, 243, 0.06)"
                        : "background.paper",
                    color: selected ? "common.white" : "text.primary",
                    "&:hover": {
                      borderWidth: 2,
                      bgcolor: selected ? "primary.light" : "#FFD9E7",
                    },
                  }}
                >
                  <Typography variant="h6" sx={{ width: "100%", mb: 0.5 }}>
                    {option.title}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: "normal" }}>
                    {option.blurb}
                  </Typography>
                </Button>
              );
            })}
          </Stack>

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
          <TextField
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            error={Boolean(form.confirmPassword && form.password !== form.confirmPassword)}
            helperText={
              form.confirmPassword && form.password !== form.confirmPassword
                ? "Passwords do not match."
                : "Enter the same password again."
            }
            value={form.confirmPassword}
            onChange={setField("confirmPassword")}
          />
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
            size="large"
            disabled={submitting || form.roles.length === 0}
          >
            {submitting ? "Creating account…" : "Find my match →"}
          </Button>
          <Typography>
            Already registered?{" "}
            <MuiLink component={Link} to="/login" color="secondary">
              Log in
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
