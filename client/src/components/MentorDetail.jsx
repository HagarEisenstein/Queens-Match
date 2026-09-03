import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";

export default function MentorDetail() {
  const { id } = useParams();
  const [mentor, setMentor] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    apiClient.get(`/mentors/${id}`)
      .then(({ data }) => {
        setMentor(data);
        setState("ready");
      })
      .catch((error) => setState(error.response?.status === 404 ? "missing" : "error"));
  }, [id]);

  if (state === "loading") return <Container sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Container>;
  if (state === "missing") return <Container sx={{ py: 4 }}><Alert severity="warning">Mentor profile not found.</Alert></Container>;
  if (state === "error") return <Container sx={{ py: 4 }}><Alert severity="error">Mentor profile could not be loaded.</Alert></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Button component={Link} to="/mentors" sx={{ mb: 3 }}>← All mentors</Button>
      <Typography variant="h2" gutterBottom>{mentor.user.fullName || mentor.user.username}</Typography>
      {(mentor.user.job || mentor.user.workplace) && (
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {[mentor.user.job, mentor.user.workplace].filter(Boolean).join(" · ")}
        </Typography>
      )}
      <Typography variant="body1" sx={{ my: 3, whiteSpace: "pre-wrap" }}>{mentor.background}</Typography>
      <Typography variant="h5" gutterBottom>What I can help with</Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>
        {mentor.adviceTopics.map((topic) => <Chip key={topic} label={topic} />)}
      </Stack>
      <Typography sx={{ mb: 3 }}>
        I offer {mentor.meetingsOffered} meeting{mentor.meetingsOffered === 1 ? "" : "s"}, each {mentor.meetingLengthMinutes} minutes long.
      </Typography>
      <Button
        component={Link}
        to={`/meetings/new?mentorId=${mentor.user.id}`}
        variant="contained"
        size="large"
      >
        Request a meeting
      </Button>
    </Container>
  );
}
