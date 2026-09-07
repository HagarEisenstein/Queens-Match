import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import api from "../api";

export default function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/users/${id}`)
      .then(({ data }) => {
        setUser(data.user);
        setError("");
      })
      .catch((requestError) => {
        setUser(null);
        setError(
          requestError.response?.data?.error?.message ||
            "User could not be loaded."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box display="grid" sx={{ placeItems: "center", minHeight: 200 }}>
        <CircularProgress aria-label="Loading user" />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!user) return null;

  return (
    <Box maxWidth="md">
      <Typography variant="h4" gutterBottom>
        {user.username}
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography>Email: {user.email}</Typography>
          <Typography>Roles: {(user.roles || []).join(", ")}</Typography>
          <Typography>Full name: {user.fullName || "—"}</Typography>
          <Typography>Job: {user.job || "—"}</Typography>
          <Typography>Workplace: {user.workplace || "—"}</Typography>
          <Typography>
            Years of experience: {user.yearsExperience ?? "—"}
          </Typography>
          <Typography>
            Tech stack: {(user.techStack || []).join(", ") || "—"}
          </Typography>
          <Typography>
            GitHub: {user.githubUrl || "—"}
          </Typography>
          <Typography>
            LinkedIn: {user.linkedinUrl || "—"}
          </Typography>
          <Typography>
            Registered:{" "}
            {user.createdAt
              ? new Date(user.createdAt).toLocaleString()
              : "—"}
          </Typography>
          <Typography>
            Completed as mentor: {user.mentorMeetingCount}
          </Typography>
          <Typography>
            Completed as mentee: {user.menteeMeetingCount}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
