import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import api from "../api";

export default function AdminInvites() {
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState(null);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const { data } = await api.get("/admin/invites");
      setInvites(data.invites || []);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    loadInvites().catch(() => {
      setError("Invitations could not be loaded.");
    });
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/admin/invites", { email });
      setInvite(data.invite);
      setEmail("");
      await loadInvites();
    } catch (requestError) {
      setInvite(null);
      setError(
        requestError.response?.data?.error?.message ||
          "Invitation could not be created."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status) => {
    if (status === "accepted") return "success";
    if (status === "declined") return "default";
    return "warning";
  };

  return (
    <Box maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Invite admin
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Enter an existing user's email address to send an in-app admin invitation.
      </Typography>
      <Paper component="form" onSubmit={submit} sx={{ p: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {invite && (
            <Alert severity="success">
              Invitation sent to {invite.email}. Current status: {invite.status}.
            </Alert>
          )}
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Sending invite..." : "Send invite"}
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Invitation status
        </Typography>
        {loadingInvites ? (
          <Typography color="text.secondary">Loading invitations...</Typography>
        ) : invites.length === 0 ? (
          <Typography color="text.secondary">No admin invitations yet.</Typography>
        ) : (
          <List disablePadding>
            {invites.map((currentInvite) => (
              <ListItem
                key={currentInvite.id}
                divider
                secondaryAction={
                  <Chip
                    label={
                      currentInvite.status === "accepted"
                        ? "Accepted"
                        : currentInvite.status === "declined"
                          ? "Declined"
                          : "Pending"
                    }
                    color={statusColor(currentInvite.status)}
                    size="small"
                  />
                }
                sx={{ px: 0 }}
              >
                <ListItemText
                  primary={currentInvite.email}
                  secondary={`User: ${currentInvite.recipient?.full_name || currentInvite.recipient?.username || "Unknown"} | Sent ${new Date(currentInvite.created_at).toLocaleString()}${currentInvite.acted_at ? ` | Responded ${new Date(currentInvite.acted_at).toLocaleString()}` : ""}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Box>
  );
}
