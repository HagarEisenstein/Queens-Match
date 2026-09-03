import React, { useEffect, useState } from "react";
import { Alert, Button, Container, Stack, TextField, Typography } from "@mui/material";
import apiClient from "../api/client";

const emptyProfile = { background: "", adviceTopics: "", meetingsOffered: 1, meetingLengthMinutes: 30 };

export default function MentorProfile() {
  const [form, setForm] = useState(emptyProfile);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiClient.get("/mentors/me")
      .then(({ data }) => {
        if (data) setForm({ ...data, adviceTopics: data.adviceTopics.join(", ") });
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await apiClient.put("/mentors/me", {
        ...form,
        adviceTopics: form.adviceTopics.split(",").map((topic) => topic.trim()).filter(Boolean),
        meetingsOffered: Number(form.meetingsOffered),
        meetingLengthMinutes: Number(form.meetingLengthMinutes),
      });
      setMessage("Mentor profile saved.");
    } catch (error) {
      setMessage(error.response?.data?.error?.message || "Profile could not be saved.");
    }
  };

  if (state === "loading") return <Container sx={{ py: 5 }}>Loading your mentor profile…</Container>;
  if (state === "error") return <Container sx={{ py: 5 }}><Alert severity="error">Your profile could not be loaded.</Alert></Container>;

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h3" gutterBottom>Your mentor profile</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Keep your mentoring offer current. Topics should be comma-separated.</Typography>
      {message && <Alert severity={message === "Mentor profile saved." ? "success" : "error"} sx={{ mb: 2 }}>{message}</Alert>}
      <Stack component="form" onSubmit={save} spacing={2}>
        <TextField label="Background" value={form.background} onChange={update("background")} multiline minRows={5} required />
        <TextField label="Advice topics" value={form.adviceTopics} onChange={update("adviceTopics")} placeholder="Career planning, mock interviews" required />
        <TextField label="Meetings offered" type="number" value={form.meetingsOffered} onChange={update("meetingsOffered")} inputProps={{ min: 1 }} required />
        <TextField label="Length of each meeting (minutes)" type="number" value={form.meetingLengthMinutes} onChange={update("meetingLengthMinutes")} inputProps={{ min: 15, max: 480, step: 15 }} required />
        <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Save profile</Button>
      </Stack>
    </Container>
  );
}
