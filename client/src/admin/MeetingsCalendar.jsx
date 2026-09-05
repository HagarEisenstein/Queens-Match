import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import api from "../api";
import StatusBadge from "./StatusBadge";
import { statusColor } from "./meetingStatus";

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default function MeetingsCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    api
      .get("/admin/meetings")
      .then(({ data }) => setMeetings(data.meetings))
      .catch(() => setMeetings([]));
  }, []);

  const days = useMemo(() => {
    const first = startOfMonth(cursor);
    const startOffset = first.getDay();
    const grid = [];
    for (let index = 0; index < 42; index += 1) {
      const day = new Date(first);
      day.setDate(1 - startOffset + index);
      grid.push(day);
    }
    return grid;
  }, [cursor]);

  const unscheduled = meetings.filter((meeting) => !meeting.scheduledTime);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Meetings calendar
        </Typography>
        <Button onClick={() => setCursor((current) => addMonths(current, -1))}>
          Previous
        </Button>
        <Typography>
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </Typography>
        <Button onClick={() => setCursor((current) => addMonths(current, 1))}>
          Next
        </Button>
      </Stack>
      <Box
        display="grid"
        gridTemplateColumns="repeat(7, 1fr)"
        gap={1}
        sx={{ mb: 3 }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <Typography key={label} variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const dayMeetings = meetings.filter(
            (meeting) =>
              meeting.scheduledTime &&
              sameDay(new Date(meeting.scheduledTime), day)
          );
          return (
            <Paper
              key={day.toISOString()}
              variant="outlined"
              sx={{
                minHeight: 110,
                p: 1,
                bgcolor: inMonth ? "background.paper" : "action.hover",
              }}
            >
              <Typography variant="caption">{day.getDate()}</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {dayMeetings.map((meeting) => (
                  <Chip
                    key={meeting.id}
                    component={Link}
                    to={`/admin/meetings/${meeting.id}`}
                    clickable
                    size="small"
                    label={`${meeting.mentee?.username || "mentee"} / ${
                      meeting.mentor?.username || "mentor"
                    }`}
                    sx={{
                      bgcolor: statusColor(meeting.status),
                      color: "#fff",
                      justifyContent: "flex-start",
                    }}
                  />
                ))}
              </Stack>
            </Paper>
          );
        })}
      </Box>
      {unscheduled.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Not yet scheduled
          </Typography>
          <Stack spacing={1}>
            {unscheduled.map((meeting) => (
              <Stack key={meeting.id} direction="row" spacing={1} alignItems="center">
                <StatusBadge status={meeting.status} />
                <Typography
                  component={Link}
                  to={`/admin/meetings/${meeting.id}`}
                  color="inherit"
                >
                  {meeting.mentee?.username} ↔ {meeting.mentor?.username}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
