import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { isTerminalStatus, statusMeta } from "../meetings/meetingStatus";

// A "match" is anyone you have an actual meeting record with — as a mentee
// connecting with a mentor, or as a mentor being connected with by a mentee.
// There's no separate "liked" concept anymore: connecting always creates a
// meeting [see MentorList's Connect button], so every match has one.
function groupMeetingsByOtherParty(meetings, currentUserId) {
  const groups = new Map();
  // `meetings` comes back most-recently-updated first (server orders by
  // updatedAt desc), so the first meeting we see per person is also the most
  // recently active one for that relationship.
  for (const meeting of meetings) {
    const iAmMentor = meeting.mentorId === currentUserId;
    const otherUser = iAmMentor ? meeting.mentee : meeting.mentor;
    if (!otherUser) continue;

    if (!groups.has(otherUser.id)) {
      groups.set(otherUser.id, { otherUser, otherIsMentor: !iAmMentor, meetings: [] });
    }
    groups.get(otherUser.id).meetings.push(meeting);
  }
  return Array.from(groups.values());
}

// Which meeting to represent as "the" stage for this relationship: the most
// recently updated one that's still active, or else the most recent overall.
function pickRepresentativeMeeting(meetings) {
  return meetings.find((meeting) => !isTerminalStatus(meeting.status)) || meetings[0];
}

export default function Matches() {
  const { user, hasRole } = useAuth();
  const [matches, setMatches] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;

    Promise.all([apiClient.get("/meetings"), apiClient.get("/mentors")])
      .then(([meetingsRes, mentorsRes]) => {
        if (!active) return;
        const mentorProfileByUserId = new Map(
          mentorsRes.data.map((profile) => [profile.user.id, profile])
        );
        const groups = groupMeetingsByOtherParty(meetingsRes.data, user.id);
        setMatches(
          groups.map((group) => ({
            ...group,
            representative: pickRepresentativeMeeting(group.meetings),
            mentorProfile: group.otherIsMentor
              ? mentorProfileByUserId.get(group.otherUser.id)
              : null,
          }))
        );
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  if (state === "loading") {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Matches could not be loaded.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" color="primary" gutterBottom>
        Your matches
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Mentors and mentees you&apos;ve connected with through meeting requests.
      </Typography>

      {matches.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            px: 3,
            borderRadius: "16px",
            bgcolor: "#FFD9E7",
          }}
        >
          <Typography variant="h5" gutterBottom>
            That&apos;s everyone for now — check back soon
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {hasRole("mentee")
              ? "Tap Connect on Discover to request a meeting with mentors you'd like to meet."
              : "Once a mentee connects with you, they'll show up here."}
          </Typography>
          {hasRole("mentee") && (
            <Button component={Link} to="/mentors" variant="contained">
              Find my match →
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={2}>
          {matches.map(({ otherUser, otherIsMentor, representative, mentorProfile }) => {
            const name = otherUser.fullName || otherUser.username;
            const meta = statusMeta(representative.status);
            // Mentors get a public profile page; mentees get a profile page
            // too, but it's only reachable by people they've matched with
            // (enforced server-side) — see MenteeDetail.jsx.
            const profileLink = mentorProfile
              ? `/mentors/${mentorProfile.id}`
              : !otherIsMentor
                ? `/mentees/${otherUser.id}`
                : null;
            return (
              <Card
                key={otherUser.id}
                elevation={0}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px" }}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {profileLink ? (
                      <IconButton
                        component={Link}
                        to={profileLink}
                        aria-label={`Open ${name}'s profile`}
                        sx={{
                          p: 0,
                          border: "2px solid transparent",
                          "&:hover": { borderColor: "primary.main" },
                        }}
                      >
                        <Avatar
                          src={otherUser.photoUrl || otherUser.photo_url || undefined}
                          alt={name}
                          sx={{ bgcolor: "primary.main" }}
                        >
                          {String(name).slice(0, 1).toUpperCase()}
                        </Avatar>
                      </IconButton>
                    ) : (
                      <Avatar
                        src={otherUser.photoUrl || otherUser.photo_url || undefined}
                        alt={name}
                        sx={{ bgcolor: "primary.main" }}
                      >
                        {String(name).slice(0, 1).toUpperCase()}
                      </Avatar>
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="h6">{name}</Typography>
                        <Chip
                          label={otherIsMentor ? "Mentor" : "Mentee"}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      {mentorProfile && (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {mentorProfile.adviceTopics.slice(0, 3).map((topic) => (
                            <Chip
                              key={topic}
                              label={topic}
                              size="small"
                              sx={{ bgcolor: "#FFD9E7" }}
                            />
                          ))}
                        </Stack>
                      )}
                      <Box sx={{ mt: 1 }}>
                        <Chip
                          component={Link}
                          to={`/meetings/${representative.id}`}
                          clickable
                          label={meta.label}
                          color={meta.color}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
