import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Container,
  Chip,
  Fade,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";

const LIKED_KEY = "queens_match_liked_mentors";

function readLikedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIKED_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function rememberLiked(mentorId) {
  const next = Array.from(new Set([...readLikedIds(), mentorId]));
  localStorage.setItem(LIKED_KEY, JSON.stringify(next));
}

export default function MentorList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [state, setState] = useState("loading");
  const [cursor, setCursor] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [exitDir, setExitDir] = useState(null);

  useEffect(() => {
    apiClient
      .get("/mentors")
      .then(({ data }) => {
        setMentors(data.filter((mentor) => mentor.user.id !== user.id));
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [user.id]);

  const current = mentors[cursor] || null;
  const peek = mentors[cursor + 1] || null;

  const onConnect = () => {
    if (!current) return;
    rememberLiked(current.id);
    setCelebrate(true);
    setExitDir("right");
    const mentorUserId = current.user.id;
    window.setTimeout(() => {
      setCelebrate(false);
      setExitDir(null);
      navigate(`/meetings/new?mentorId=${mentorUserId}`);
    }, 650);
  };

  const onMaybeLater = () => {
    if (!current) return;
    setExitDir("left");
    window.setTimeout(() => {
      setExitDir(null);
      setCursor((value) => value + 1);
    }, 280);
  };

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
        <Alert severity="error">Mentors could not be loaded.</Alert>
      </Container>
    );
  }

  if (mentors.length === 0) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h3" gutterBottom color="primary">
          Find a mentor
        </Typography>
        <Alert severity="info">No mentor profiles are available yet.</Alert>
      </Container>
    );
  }

  if (!current) {
    return (
      <Container maxWidth="sm" sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="h3" color="primary" gutterBottom>
          That&apos;s everyone for now
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Check back soon — or browse again to revisit mentors you skipped.
        </Typography>
        <Button variant="contained" onClick={() => setCursor(0)}>
          Widen my view
        </Button>
      </Container>
    );
  }

  const name = current.user.fullName || current.user.username;
  const topicCount = Math.min(current.adviceTopics.length, 3);

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom color="primary">
        Find a mentor
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Explore mentors and find the experience that fits your goals.
      </Typography>

      <Box sx={{ position: "relative", minHeight: 420, mb: 2 }}>
        {peek && (
          <Card
            aria-hidden
            sx={{
              position: "absolute",
              insetInline: 12,
              top: 12,
              bottom: 0,
              borderRadius: "16px",
              bgcolor: "#FFD9E7",
              boxShadow: "none",
              border: "1px solid",
              borderColor: "divider",
              zIndex: 0,
            }}
          />
        )}

        <Card
          sx={{
            position: "relative",
            zIndex: 1,
            borderRadius: "16px",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 12px 32px rgba(255, 125, 156, 0.18)",
            transform:
              exitDir === "right"
                ? "translateX(120%) rotate(8deg)"
                : exitDir === "left"
                  ? "translateX(-120%) rotate(-8deg)"
                  : "none",
            opacity: exitDir ? 0 : 1,
            transition: "transform 0.28s ease-out, opacity 0.28s ease-out",
            "@media (prefers-reduced-motion: reduce)": {
              transition: "none",
              transform: "none",
              opacity: 1,
            },
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 16,
              insetInlineEnd: 16,
              bgcolor: "secondary.main",
              color: "common.white",
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              fontSize: 13,
              fontWeight: 600,
              zIndex: 2,
            }}
          >
            {topicCount} focus area{topicCount === 1 ? "" : "s"}
          </Box>

          <CardContent sx={{ pt: 4 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Avatar
                src={current.user.photoUrl || current.user.photo_url || undefined}
                alt={name}
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: "primary.main",
                  border: "3px solid",
                  borderColor: "primary.light",
                }}
              >
                {String(name).slice(0, 1).toUpperCase()}
              </Avatar>
              <Box>
                <Typography
                  variant="h5"
                  sx={{ fontFamily: '"Sunday", "Fredoka", "Nunito", sans-serif' }}
                >
                  {name}
                </Typography>
                {(current.user.job || current.user.workplace) && (
                  <Typography color="text.secondary">
                    {[current.user.job, current.user.workplace].filter(Boolean).join(" · ")}
                  </Typography>
                )}
              </Box>
            </Stack>

            <Typography sx={{ mb: 2 }}>{current.background}</Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mb: 2 }}>
              {current.adviceTopics.map((topic) => (
                <Chip
                  key={topic}
                  label={topic}
                  size="small"
                  sx={{ bgcolor: "#FFD9E7", color: "text.primary" }}
                />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {current.meetingsOffered} meeting{current.meetingsOffered === 1 ? "" : "s"} ·{" "}
              {current.meetingLengthMinutes} minutes each
            </Typography>
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: "wrap" }}>
            <Button component={Link} to={`/mentors/${current.id}`} size="small">
              View profile
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" color="secondary" onClick={onMaybeLater}>
              Maybe later
            </Button>
            <Button variant="contained" onClick={onConnect}>
              Connect →
            </Button>
          </CardActions>
        </Card>
      </Box>

      <Fade in={celebrate}>
        <Alert
          severity="success"
          sx={{
            bgcolor: "#FFD9E7",
            color: "text.primary",
            borderRadius: 2,
            "& .MuiAlert-icon": { color: "primary.main" },
          }}
        >
          You&apos;re in! Say hi 👋
        </Alert>
      </Fade>
    </Container>
  );
}
