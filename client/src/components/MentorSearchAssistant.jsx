import React, { useState } from "react";
import { Link } from "react-router-dom";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Drawer,
  Fab,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { searchMentors } from "../api/client";

const SEARCH_INTENTS = new Set([
  "find_mentor",
  "clarification_needed",
  "out_of_scope",
]);

function MentorMatchCard({ mentor }) {
  const name = mentor.user.fullName || mentor.user.username;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Avatar src={mentor.user.photoUrl || undefined} alt={name}>
            {String(name).slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">{name}</Typography>
            {(mentor.user.job || mentor.user.workplace) && (
              <Typography variant="body2" color="text.secondary">
                {[mentor.user.job, mentor.user.workplace]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            )}
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {mentor.background}
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
          {mentor.adviceTopics.slice(0, 3).map((topic) => (
            <Chip key={topic} label={topic} size="small" />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          {mentor.meetingsOffered} meeting
          {mentor.meetingsOffered === 1 ? "" : "s"} ·{" "}
          {mentor.meetingLengthMinutes} minutes each
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          spacing={1}
          sx={{ mt: 1.5 }}
        >
          <Button
            component={Link}
            to={`/mentors/${mentor.id}`}
            aria-label={`View ${name}'s profile`}
            size="small"
          >
            View profile
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function MentorSearchAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [requestStatus, setRequestStatus] = useState("idle");
  const [mentors, setMentors] = useState([]);
  const [intent, setIntent] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!searchText.trim() || requestStatus === "loading") return;

    setRequestStatus("loading");
    setMentors([]);
    setIntent(null);
    try {
      const { data } = await searchMentors(searchText.trim());
      if (!SEARCH_INTENTS.has(data?.intent) || !Array.isArray(data?.mentors)) {
        throw new Error("Mentor search returned malformed results");
      }
      setMentors(data.mentors);
      setIntent(data.intent);
      setRequestStatus("success");
    } catch {
      setRequestStatus("error");
    }
  };

  const isLoading = requestStatus === "loading";

  return (
    <>
      <Fab
        variant="extended"
        color="secondary"
        aria-label="Help me find a mentor"
        onClick={() => setIsOpen(true)}
        sx={{
          position: "fixed",
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: (theme) => theme.zIndex.speedDial,
          px: { xs: 2, sm: 2.5 },
          boxShadow: 3,
          textTransform: "none",
          fontWeight: 600,
        }}
      >
        <AutoAwesomeRoundedIcon sx={{ mr: 1 }} />
        Help me find a mentor
      </Fab>

      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        PaperProps={{
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": "mentor-search-title",
          "aria-describedby": "mentor-search-description",
          sx: {
            width: { xs: "100%", sm: 400 },
            maxWidth: "100vw",
            borderRadius: { xs: 0, sm: "16px 0 0 16px" },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            p: { xs: 2.5, sm: 3 },
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 1.5 }}
          >
            <Typography id="mentor-search-title" variant="h5" color="primary">
              Find your mentor
            </Typography>
            <IconButton
              aria-label="Close mentor search"
              onClick={() => setIsOpen(false)}
              edge="end"
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <Typography
            id="mentor-search-description"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Describe what kind of help you’re looking for, and we’ll use it to
            find relevant mentors.
          </Typography>

          <TextField
            label="What kind of help do you need?"
            placeholder="I’m looking for someone who can help me prepare for a backend interview and review my CV"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              if (requestStatus !== "loading") {
                setRequestStatus("idle");
                setMentors([]);
                setIntent(null);
              }
            }}
            disabled={isLoading}
            multiline
            minRows={5}
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            disabled={!searchText.trim() || isLoading}
            sx={{ mt: 2 }}
          >
            {isLoading ? (
              <>
                <CircularProgress
                  size={18}
                  color="inherit"
                  aria-label="Searching for mentors"
                  sx={{ mr: 1 }}
                />
                Searching…
              </>
            ) : (
              "Find mentors"
            )}
          </Button>

          <Box
            sx={{ mt: 2, flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}
            aria-live="polite"
          >
            {requestStatus === "error" && (
              <Alert severity="error">
                We couldn’t find mentors right now. Please try again.
              </Alert>
            )}

            {requestStatus === "success" &&
              intent === "clarification_needed" && (
                <Alert severity="info">
                  Tell us a little more about what you want help with —
                  interviews, CV, career direction, or technical skills.
                </Alert>
              )}

            {requestStatus === "success" && intent === "out_of_scope" && (
              <Alert severity="info">
                I can help you find a mentor for career, interview, and technical
                guidance.
              </Alert>
            )}

            {requestStatus === "success" &&
              intent === "find_mentor" &&
              mentors.length === 0 && (
                <Alert severity="info">
                  No matching mentors are available yet.
                </Alert>
              )}

            {requestStatus === "success" &&
              intent === "find_mentor" &&
              mentors.length > 0 && (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Best matches
                  </Typography>
                  {mentors.map((mentor) => (
                    <MentorMatchCard key={mentor.id} mentor={mentor} />
                  ))}
                </Stack>
              )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
