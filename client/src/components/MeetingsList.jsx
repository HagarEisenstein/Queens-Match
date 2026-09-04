import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Chip,
  CircularProgress,
  Container,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { statusMeta } from "../meetings/meetingStatus";

// "My meetings" — every meeting the signed-in user is part of, on either side.
export default function MeetingsList() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    apiClient
      .get("/meetings")
      .then(({ data }) => {
        setMeetings(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") {
    return <Container sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Container>;
  }
  if (state === "error") {
    return <Container sx={{ py: 4 }}><Alert severity="error">Your meetings could not be loaded.</Alert></Container>;
  }

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h3" gutterBottom>My meetings</Typography>
      {meetings.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          You have no meetings yet. Find a mentor to request one.
        </Alert>
      ) : (
        <List>
          {meetings.map((meeting) => {
            const iAmMentor = meeting.mentorId === user.id;
            const other = iAmMentor ? meeting.mentee : meeting.mentor;
            const meta = statusMeta(meeting.status);
            return (
              <ListItemButton
                key={meeting.id}
                component={Link}
                to={`/meetings/${meeting.id}`}
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <span>
                        {iAmMentor ? "Mentoring" : "With"} {other?.fullName || other?.username || "a member"}
                      </span>
                      <Chip label={iAmMentor ? "as mentor" : "as mentee"} size="small" variant="outlined" />
                    </Stack>
                  }
                  secondary={
                    meeting.scheduledTime
                      ? `Scheduled for ${new Date(meeting.scheduledTime).toLocaleString()}`
                      : `Requested ${new Date(meeting.createdAt).toLocaleDateString()}`
                  }
                />
                <Chip label={meta.label} color={meta.color} size="small" />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Container>
  );
}
