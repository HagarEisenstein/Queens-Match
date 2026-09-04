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
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function MentorDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [mentor, setMentor] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    apiClient
      .get(`/mentors/${id}`)
      .then(({ data }) => {
        setMentor(data);
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
        <Alert severity="warning">Mentor profile not found.</Alert>
      </Container>
    );
  }
  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Mentor profile could not be loaded.</Alert>
      </Container>
    );
  }

  const name = mentor.user.fullName || mentor.user.username;
  const isOwnProfile = mentor.user.id === user.id;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Button component={Link} to="/mentors" sx={{ mb: 3, color: "secondary.main" }}>
        ← All mentors
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
            src={mentor.user.photoUrl || mentor.user.photo_url || undefined}
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
            {(mentor.user.job || mentor.user.workplace) && (
              <Typography variant="h6" color="text.secondary">
                {[mentor.user.job, mentor.user.workplace].filter(Boolean).join(" · ")}
              </Typography>
            )}
          </Box>
        </Stack>

        <Typography variant="body1" sx={{ my: 3, whiteSpace: "pre-wrap" }}>
          {mentor.background}
        </Typography>

        <Typography variant="h5" gutterBottom>
          What I can help with
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>
          {mentor.adviceTopics.map((topic) => (
            <Chip key={topic} label={topic} sx={{ bgcolor: "#FFD9E7" }} />
          ))}
        </Stack>

        <Typography sx={{ mb: 3 }}>
          I offer {mentor.meetingsOffered} meeting{mentor.meetingsOffered === 1 ? "" : "s"}, each{" "}
          {mentor.meetingLengthMinutes} minutes long.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {isOwnProfile ? (
            <Alert severity="info">This is your mentor profile, so you cannot request a meeting with yourself.</Alert>
          ) : (
            <Button
              component={Link}
              to={`/meetings/new?mentorId=${mentor.user.id}`}
              variant="contained"
              size="large"
            >
              Request a meeting
            </Button>
          )}
          <Button component={Link} to="/mentors" variant="outlined" color="secondary" size="large">
            Maybe later
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
