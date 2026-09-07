import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import apiClient from "../api/client";

// Read-only view of a mentee's basic profile, mirroring MentorDetail.jsx.
// Only reachable for people the mentee has actually matched with — the
// server enforces this and returns 404 otherwise, same as an unknown id.
export default function MenteeDetail() {
  const { id } = useParams();
  const [mentee, setMentee] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    apiClient
      .get(`/users/${id}`)
      .then(({ data }) => {
        setMentee(data.user);
        setState("ready");
      })
      .catch((error) => setState(error.response?.status === 404 ? "missing" : "error"));
  }, [id]);

  if (state === "loading") {
    return (
      <Container sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }
  if (state === "missing") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">
          That profile isn&apos;t available — you can only view profiles of mentees you&apos;ve matched with.
        </Alert>
        <Button component={Link} to="/matches" sx={{ mt: 2 }}>
          ← Back to matches
        </Button>
      </Container>
    );
  }
  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">This profile could not be loaded.</Alert>
      </Container>
    );
  }

  const name = mentee.full_name || mentee.username;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Button component={Link} to="/matches" sx={{ mb: 3, color: "secondary.main" }}>
        ← Back to matches
      </Button>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          background: "linear-gradient(180deg, #FFFFFF 0%, #FFF0F6 100%)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Avatar
            src={mentee.photo_url || undefined}
            alt={name}
            sx={{
              width: 96,
              height: 96,
              bgcolor: "primary.main",
              border: "3px solid",
              borderColor: "primary.light",
            }}
          >
            {String(name).slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ textAlign: { xs: "center", sm: "start" } }}>
            <Typography variant="h2" color="primary" gutterBottom>
              {name}
            </Typography>
            {(mentee.job || mentee.workplace) && (
              <Typography variant="h6" color="text.secondary">
                {[mentee.job, mentee.workplace].filter(Boolean).join(" · ")}
              </Typography>
            )}
            {Number.isFinite(mentee.years_experience) && (
              <Typography color="text.secondary">
                {mentee.years_experience} year{mentee.years_experience === 1 ? "" : "s"} of experience
              </Typography>
            )}
          </Box>
        </Stack>

        {mentee.tech_stack?.length > 0 && (
          <>
            <Typography variant="h5" gutterBottom>
              Tech stack
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>
              {mentee.tech_stack.map((tech) => (
                <Chip key={tech} label={tech} sx={{ bgcolor: "#FFD9E7" }} />
              ))}
            </Stack>
          </>
        )}

        {(mentee.github_url || mentee.linkedin_url) && (
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            {mentee.github_url && (
              <Button
                href={mentee.github_url}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<GitHubIcon />}
                variant="outlined"
                color="secondary"
              >
                GitHub
              </Button>
            )}
            {mentee.linkedin_url && (
              <Button
                href={mentee.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<LinkedInIcon />}
                variant="outlined"
                color="secondary"
              >
                LinkedIn
              </Button>
            )}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
