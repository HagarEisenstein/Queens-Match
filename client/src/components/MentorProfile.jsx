import React, { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  ADVICE_TOPICS,
  MAX_TOPIC_LENGTH,
  groupForTopic,
} from "../constants/adviceTopics";

const emptyProfile = {
  background: "",
  adviceTopics: [],
  meetingsOffered: 1,
  meetingLengthMinutes: 30,
};

export default function MentorProfile() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState(emptyProfile);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiClient
      .get("/mentors/me")
      .then(({ data }) => {
        if (data) {
          setForm({ ...emptyProfile, ...data });
        }
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const update = (field) => (event) =>
    setForm({ ...form, [field]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    if (form.adviceTopics.length === 0) {
      setMessage("Please select at least one advice topic.");
      return;
    }
    try {
      await apiClient.put("/mentors/me", {
        ...form,
        adviceTopics: form.adviceTopics,
        meetingsOffered: Number(form.meetingsOffered),
        meetingLengthMinutes: Number(form.meetingLengthMinutes),
      });
      if (refreshUser) await refreshUser();
      setMessage("Mentor profile saved.");
    } catch (error) {
      setMessage(
        error.response?.data?.error?.message || "Profile could not be saved."
      );
    }
  };

  if (state === "loading") {
    return <Container sx={{ py: 5 }}>Loading your mentor profile…</Container>;
  }
  if (state === "error") {
    return (
      <Container sx={{ py: 5 }}>
        <Alert severity="error">Your profile could not be loaded.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Paper
        elevation={0}
        sx={{ p: { xs: 3, md: 4 }, border: "1px solid", borderColor: "divider" }}
      >
        <Typography variant="h3" color="primary" gutterBottom>
          Your mentor profile
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Keep your mentoring offer current. Choose the topics you can advise on.
        </Typography>
        {message && (
          <Alert
            severity={message === "Mentor profile saved." ? "success" : "error"}
            sx={{ mb: 2 }}
          >
            {message}
          </Alert>
        )}
        {message === "Mentor profile saved." && (
          <Button href="/mentors" variant="outlined" color="secondary" sx={{ mb: 2 }}>
            Browse mentors →
          </Button>
        )}
        <Stack component="form" onSubmit={save} spacing={2}>
          <TextField
            label="Background"
            value={form.background}
            onChange={update("background")}
            multiline
            minRows={5}
            required
          />
          <Autocomplete
            multiple
            freeSolo
            options={ADVICE_TOPICS}
            groupBy={groupForTopic}
            value={form.adviceTopics}
            onChange={(event, newValue) => {
              // Trim, drop empties/overlong entries, and de-duplicate so a
              // custom topic is stored just like a built-in one.
              const cleaned = [];
              newValue.forEach((raw) => {
                const topic = String(raw).trim();
                if (topic && topic.length <= MAX_TOPIC_LENGTH && !cleaned.includes(topic)) {
                  cleaned.push(topic);
                }
              });
              setForm({ ...form, adviceTopics: cleaned });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Advice topics"
                placeholder="Choose from the list or type your own"
                helperText="Pick built-in topics, or type your own and press Enter."
              />
            )}
          />
          <TextField
            label="Meetings offered"
            type="number"
            value={form.meetingsOffered}
            onChange={update("meetingsOffered")}
            inputProps={{ min: 1 }}
            required
          />
          <TextField
            label="Length of each meeting (minutes)"
            type="number"
            value={form.meetingLengthMinutes}
            onChange={update("meetingLengthMinutes")}
            inputProps={{ min: 15, max: 480, step: 15 }}
            required
          />
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Save profile
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
