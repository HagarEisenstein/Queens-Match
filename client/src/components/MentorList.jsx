import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Chip,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";

export default function MentorList() {
  const [mentors, setMentors] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    apiClient.get("/mentors")
      .then(({ data }) => {
        setMentors(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") return <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>;
  if (state === "error") return <Container sx={{ py: 4 }}><Alert severity="error">Mentors could not be loaded.</Alert></Container>;

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>Find a mentor</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Explore mentors and find the experience that fits your goals.
      </Typography>
      {mentors.length === 0 ? (
        <Alert severity="info">No mentor profiles are available yet.</Alert>
      ) : (
        <Grid container spacing={3}>
          {mentors.map((mentor) => (
            <Grid item xs={12} md={6} lg={4} key={mentor.id}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h5">{mentor.user.fullName || mentor.user.username}</Typography>
                  {(mentor.user.job || mentor.user.workplace) && (
                    <Typography color="text.secondary" gutterBottom>
                      {[mentor.user.job, mentor.user.workplace].filter(Boolean).join(" · ")}
                    </Typography>
                  )}
                  <Typography sx={{ mb: 2 }}>{mentor.background}</Typography>
                  {mentor.adviceTopics.map((topic) => <Chip key={topic} label={topic} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)}
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    {mentor.meetingsOffered} meeting{mentor.meetingsOffered === 1 ? "" : "s"} · {mentor.meetingLengthMinutes} minutes each
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button component={Link} to={`/mentors/${mentor.id}`} size="small">View profile</Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
