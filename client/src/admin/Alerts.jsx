import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import api from "../api";
import StatusBadge from "./StatusBadge";

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function Alerts() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState("");

  useEffect(() => {
    api
      .get("/admin/alerts")
      .then(({ data }) => setAlerts(data.alerts))
      .catch((requestError) =>
        setError(
          requestError.response?.data?.error?.message ||
            "Alerts could not be loaded."
        )
      );
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!alerts) return null;

  const reviewAlert = (key) => {
    setReviewing(key);
    api.put(`/admin/alerts/${encodeURIComponent(key)}/review`, { status: "approved" })
      .then(() => setAlerts((current) => ({ ...current, persistent: current.persistent.filter((item) => item.idempotencyKey !== key) })))
      .catch(() => setError("Alert could not be reviewed."))
      .finally(() => setReviewing("") );
  };

  const { meetingsNotCompleted = [], overdueFeedback = [], overloadedMentors = [], persistent = [] } = alerts;
  const isEmpty =
    meetingsNotCompleted.length === 0 &&
    overdueFeedback.length === 0 &&
    overloadedMentors.length === 0 &&
    persistent.length === 0;

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Admin alerts
      </Typography>
      {isEmpty && <Alert severity="success">No alerts right now.</Alert>}

      {persistent.length > 0 && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h6">Open exception alerts</Typography>
          {persistent.map((item) => (
            <Paper key={item.idempotencyKey} sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                <Typography sx={{ flex: 1 }}>{item.alertType.replaceAll("_", " ")}</Typography>
                <MuiLink component={Link} to={item.meetingId ? `/admin/meetings/${item.meetingId}` : "/admin/alerts"}>Review</MuiLink>
                <Button size="small" onClick={() => reviewAlert(item.idempotencyKey)} disabled={reviewing === item.idempotencyKey}>Approve</Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {meetingsNotCompleted.length > 0 && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h6">Meetings that did not happen</Typography>
          {meetingsNotCompleted.map((meeting) => (
            <Paper key={meeting.id} sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StatusBadge status={meeting.status} />
                <Typography>
                  {meeting.mentee?.username} ↔ {meeting.mentor?.username}
                </Typography>
                <Typography color="text.secondary">
                  {formatDateTime(meeting.scheduledTime)}
                </Typography>
                <MuiLink component={Link} to={`/admin/meetings/${meeting.id}`}>
                  Open meeting
                </MuiLink>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {overdueFeedback.length > 0 && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography variant="h6">Feedback outstanding for more than a week</Typography>
          {overdueFeedback.map((item, index) => (
            <Paper key={`${item.meetingId}-${index}`} sx={{ p: 2 }}>
              <Typography>
                {item.recipient?.username || item.recipient?.email} —
                requested {formatDateTime(item.feedbackRequestedAt)}
              </Typography>
              <MuiLink component={Link} to={`/admin/meetings/${item.meetingId}`}>
                Open meeting
              </MuiLink>
            </Paper>
          ))}
        </Stack>
      )}

      {overloadedMentors.length > 0 && (
        <Stack spacing={2}>
          <Typography variant="h6">Mentors with more than 10 completed meetings</Typography>
          {overloadedMentors.map((entry) => (
            <Paper key={entry.mentorId} sx={{ p: 2 }}>
              <Typography>
                {entry.mentor?.username || entry.mentorId} has completed{" "}
                {entry.completedCount} mentoring meetings.{" "}
                <MuiLink component={Link} to={`/admin/users/${entry.mentorId}`}>
                  View user
                </MuiLink>
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </>
  );
}
