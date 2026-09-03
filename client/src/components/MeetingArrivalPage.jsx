import React, { useState } from "react";
import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import apiClient from "../api/client";

export default function MeetingArrivalPage() {
  const { id } = useParams();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const confirmArrival = async () => {
    setStatus("saving");
    setError("");
    try {
      await apiClient.put(`/engagement/meetings/${id}/arrival`);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err.response?.data?.error?.message || "Could not confirm arrival.");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom>
        Confirm arrival
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Let QueenB know you plan to attend this meeting.
      </Typography>
      {status === "saved" && <Alert severity="success" sx={{ mb: 2 }}>Arrival confirmed.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2}>
        <Button
          variant="contained"
          onClick={confirmArrival}
          disabled={status === "saving" || status === "saved"}
        >
          I will attend
        </Button>
      </Stack>
    </Container>
  );
}
