import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import api from "../api";
import StatusBadge from "./StatusBadge";
import { MEETING_STATUSES, statusLabel } from "./meetingStatus";

function formatWhen(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

export default function MeetingsReport() {
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/admin/users")
      .then(({ data }) => setUsers(data.users))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    let active = true;
    const params = {};
    if (status) params.status = status;
    if (participantId) params.participantId = participantId;
    api
      .get("/admin/meetings", { params })
      .then(({ data }) => {
        if (!active) return;
        setMeetings(data.meetings);
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.error?.message ||
            "Meetings could not be loaded."
        );
      });
    return () => {
      active = false;
    };
  }, [status, participantId]);

  const userOptions = useMemo(
    () =>
      users.map((user) => ({
        id: user.id,
        label: `${user.username} (${user.email})`,
      })),
    [users]
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Meetings report
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={status}
            displayEmpty
            onChange={(event) => setStatus(event.target.value)}
          >
            <MenuItem value="">
              <em>All statuses</em>
            </MenuItem>
            {MEETING_STATUSES.map((value) => (
              <MenuItem key={value} value={value}>
                {statusLabel(value)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel id="participant-filter-label">Participant</InputLabel>
          <Select
            labelId="participant-filter-label"
            label="Participant"
            value={participantId}
            displayEmpty
            onChange={(event) => setParticipantId(event.target.value)}
          >
            <MenuItem value="">
              <em>All participants</em>
            </MenuItem>
            {userOptions.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {!error && meetings.length === 0 && (
        <Alert severity="info">No meetings match these filters.</Alert>
      )}
      {meetings.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mentee</TableCell>
                <TableCell>Mentor</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Scheduled time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {meetings.map((meeting) => (
                <TableRow key={meeting.id} hover>
                  <TableCell>
                    <MuiLink component={Link} to={`/admin/meetings/${meeting.id}`}>
                      {meeting.mentee?.username || meeting.menteeId}
                    </MuiLink>
                  </TableCell>
                  <TableCell>
                    {meeting.mentor?.username || meeting.mentorId}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={meeting.canonicalStatus || meeting.status} />
                  </TableCell>
                  <TableCell>{formatWhen(meeting.scheduledTime)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
