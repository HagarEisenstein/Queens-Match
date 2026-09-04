import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

// Landing page for the "Request a meeting" CTA on a mentor's detail page.
// Confirms who the mentee is about to reach out to, then fires the one-click
// request [R4.2] and hands off to the meeting's detail view.
export default function RequestMeeting() {
  const [searchParams] = useSearchParams();
  const mentorId = searchParams.get("mentorId");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mentor, setMentor] = useState(null);
  const [state, setState] = useState("loading");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mentorId) {
      setState("invalid");
      return;
    }
    // The detail-page CTA passes the mentor's user id; find their profile so we
    // can show a friendly confirmation rather than a bare id.
    apiClient
      .get("/mentors")
      .then(({ data }) => {
        const match = data.find(
          (profile) => profile.user.id === mentorId && profile.user.id !== user.id
        );
        setMentor(match || null);
        setState(match ? "ready" : "missing");
      })
      .catch(() => setState("error"));
  }, [mentorId, user.id]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { data } = await apiClient.post("/meetings", { mentorId });
      navigate(`/meetings/${data.id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || "Could not send the request.");
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return <Container sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Container>;
  }
  if (state === "invalid") {
    return <Container sx={{ py: 4 }}><Alert severity="warning">No mentor was specified.</Alert></Container>;
  }
  if (state === "missing") {
    return <Container sx={{ py: 4 }}><Alert severity="warning">That mentor could not be found.</Alert></Container>;
  }
  if (state === "error") {
    return <Container sx={{ py: 4 }}><Alert severity="error">Something went wrong loading the mentor.</Alert></Container>;
  }

  const name = mentor.user.fullName || mentor.user.username;

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Button component={Link} to={`/mentors/${mentor.id}`} sx={{ mb: 3 }}>← Back to profile</Button>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>Request a meeting</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          You're about to ask <strong>{name}</strong> to mentor you. They'll be notified and can offer
          you some times to choose from.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack direction="row" spacing={2}>
          <Button variant="contained" size="large" onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send request"}
          </Button>
          <Button component={Link} to={`/mentors/${mentor.id}`} disabled={submitting}>Cancel</Button>
        </Stack>
      </Paper>
    </Container>
  );
}
