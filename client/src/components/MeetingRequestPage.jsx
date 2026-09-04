import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";

export default function MeetingRequestPage() {
  const [params] = useSearchParams();
  const mentorUserId = params.get("mentorId");
  const [mentor, setMentor] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (!mentorUserId) {
      setState("missing");
      return undefined;
    }

    let active = true;
    apiClient
      .get("/mentors")
      .then(({ data }) => {
        if (!active) return;
        const match = data.find((item) => String(item.user?.id) === String(mentorUserId));
        setMentor(match || null);
        setState(match ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [mentorUserId]);

  if (state === "loading") {
    return (
      <Container sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Could not load mentor details.</Alert>
        <Button component={Link} to="/mentors" sx={{ mt: 2 }}>
          Back to Discover
        </Button>
      </Container>
    );
  }

  if (state === "missing" || !mentor) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="warning">Choose a mentor from Discover to request a meeting.</Alert>
        <Button component={Link} to="/mentors" variant="contained" sx={{ mt: 2 }}>
          Find my match →
        </Button>
      </Container>
    );
  }

  const name = mentor.user.fullName || mentor.user.username;
  const linkedin = mentor.user.linkedinUrl || mentor.user.linkedin_url;

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#FFF0F6",
        }}
      >
        <Typography variant="h3" color="primary" gutterBottom>
          Connect with {name}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          You&apos;re in! Reach out to introduce yourself and suggest a time that works for both of
          you.
        </Typography>
        <Stack spacing={2}>
          {linkedin && (
            <Button
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="large"
            >
              Say hi on LinkedIn →
            </Button>
          )}
          <Button
            component={Link}
            to={`/mentors/${mentor.id}`}
            variant={linkedin ? "outlined" : "contained"}
            color={linkedin ? "secondary" : "primary"}
            size="large"
          >
            Back to profile
          </Button>
          <Button component={Link} to="/mentors" color="secondary">
            Keep browsing
          </Button>
        </Stack>
        <Box sx={{ mt: 3 }}>
          <Alert severity="success" sx={{ bgcolor: "#FFD9E7", color: "text.primary" }}>
            You&apos;re in! Say hi 👋
          </Alert>
        </Box>
      </Paper>
    </Container>
  );
}
