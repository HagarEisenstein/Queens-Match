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

export default function Matches() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const likedIds = readLikedIds();
    if (likedIds.length === 0) {
      setState("ready");
      return undefined;
    }

    let active = true;
    apiClient
      .get("/mentors")
      .then(({ data }) => {
        if (!active) return;
        const liked = new Set(likedIds);
        setMentors(
          data.filter((mentor) => liked.has(mentor.id) && mentor.user.id !== user.id)
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
        Mentors you connected with while browsing Discover.
      </Typography>

      {mentors.length === 0 ? (
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
            Tap Connect on Discover to save mentors you&apos;d like to meet.
          </Typography>
          <Button component={Link} to="/mentors" variant="contained">
            Find my match →
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {mentors.map((mentor) => {
            const name = mentor.user.fullName || mentor.user.username;
            return (
              <Card
                key={mentor.id}
                elevation={0}
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: "16px" }}
              >
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={mentor.user.photoUrl || mentor.user.photo_url || undefined}
                      alt={name}
                      sx={{ bgcolor: "primary.main" }}
                    >
                      {String(name).slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">{name}</Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {mentor.adviceTopics.slice(0, 3).map((topic) => (
                          <Chip
                            key={topic}
                            label={topic}
                            size="small"
                            sx={{ bgcolor: "#FFD9E7" }}
                          />
                        ))}
                      </Stack>
                    </Box>
                    <Button
                      component={Link}
                      to={`/mentors/${mentor.id}`}
                      variant="contained"
                      size="small"
                    >
                      View profile
                    </Button>
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
