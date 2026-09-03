import React, { useState } from "react";
import { Alert, Button, Container, Rating, Stack, TextField, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import apiClient from "../api/client";

export default function MeetingFeedbackPage() {
  const { id } = useParams();
  const [rating, setRating] = useState(5);
  const [openText, setOpenText] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    setError("");
    try {
      await apiClient.post(`/engagement/meetings/${id}/feedback`, {
        rating: Number(rating),
        openText,
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err.response?.data?.error?.message || "Could not submit feedback.");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom>
        Meeting feedback
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Rate the meeting and leave an optional note.
      </Typography>
      {status === "saved" && <Alert severity="success" sx={{ mb: 2 }}>Feedback submitted. Thank you!</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack component="form" onSubmit={submit} spacing={3}>
        <Stack spacing={1}>
          <Typography component="legend">Rating</Typography>
          <Rating
            name="meeting-rating"
            value={Number(rating)}
            onChange={(_, value) => setRating(value || 1)}
          />
        </Stack>
        <TextField
          label="Open feedback"
          value={openText}
          onChange={(event) => setOpenText(event.target.value)}
          multiline
          minRows={4}
        />
        <Button type="submit" variant="contained" disabled={status === "saving" || status === "saved"}>
          Submit feedback
        </Button>
      </Stack>
    </Container>
  );
}
