import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import api from "../api";
import StatusBadge from "./StatusBadge";

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Not scheduled";
}

function outcomeSummary(response) {
  if (response.happened) return "Reported: happened";
  const parts = [`Reported: did not happen`];
  if (response.absentParty) parts.push(`absent: ${response.absentParty}`);
  if (response.stillWantToMeet != null) {
    parts.push(response.stillWantToMeet ? "still wants to meet" : "does not want to re-coordinate");
  }
  return parts.join(" — ");
}

export default function MeetingDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/meetings/${id}`)
      .then(({ data: body }) => {
        setData(body);
        setError("");
      })
      .catch((requestError) => {
        setData(null);
        setError(
          requestError.response?.data?.error?.message ||
            "Meeting could not be loaded."
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box display="grid" sx={{ placeItems: "center", minHeight: 200 }}>
        <CircularProgress aria-label="Loading meeting" />
      </Box>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const { meeting, outcomeResponses, feedback, feedbackRequests } = data;

  return (
    <Box maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Meeting detail
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusBadge status={meeting.status} />
            <Chip
              size="small"
              label={meeting.isCompleted ? "Completed" : "Not yet completed"}
              color={meeting.isCompleted ? "success" : "default"}
              variant={meeting.isCompleted ? "filled" : "outlined"}
            />
          </Stack>
          <Typography>
            Mentee: {meeting.mentee?.username} ({meeting.mentee?.email})
          </Typography>
          <Typography>
            Mentor: {meeting.mentor?.username} ({meeting.mentor?.email})
          </Typography>
          <Typography>
            Scheduled time: {formatDateTime(meeting.scheduledTime)}
          </Typography>

          <Typography variant="h6">Offered times</Typography>
          {meeting.timeSlots.length === 0 && (
            <Typography color="text.secondary">No times offered yet.</Typography>
          )}
          {meeting.timeSlots.map((slot) => (
            <Typography key={slot.id}>
              {formatDateTime(slot.startTime)} – {formatDateTime(slot.endTime)}
            </Typography>
          ))}

          <Typography variant="h6">Outcome responses</Typography>
          {outcomeResponses.length === 0 && (
            <Typography color="text.secondary">
              Neither participant has reported on this meeting yet.
            </Typography>
          )}
          {outcomeResponses.map((response) => (
            <Typography key={response.id}>
              {response.role === "mentee" ? "Mentee" : "Mentor"}: {outcomeSummary(response)}
            </Typography>
          ))}

          <Typography variant="h6">Feedback</Typography>
          {feedback.length === 0 && (
            <Typography color="text.secondary">No feedback yet.</Typography>
          )}
          {feedback.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
              <Typography>Rating: {item.rating}/5</Typography>
              <Typography>{item.openText || "(no written feedback)"}</Typography>
            </Paper>
          ))}

          {feedbackRequests.length > 0 && (
            <>
              <Typography variant="h6">Feedback requests</Typography>
              {feedbackRequests.map((request) => {
                const recipientName =
                  request.recipientId === meeting.mentee?.id
                    ? meeting.mentee?.username
                    : request.recipientId === meeting.mentor?.id
                      ? meeting.mentor?.username
                      : request.recipientId;
                return (
                  <Typography key={request.id}>
                    {recipientName} — requested {formatDateTime(request.feedbackRequestedAt)}
                    {request.fulfilledAt
                      ? ` — fulfilled ${formatDateTime(request.fulfilledAt)}`
                      : " — outstanding"}
                  </Typography>
                );
              })}
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
