import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MEETING_STATUS } from "../meetings/meetingStatus";
import AddToCalendarButtons from "./AddToCalendarButtons";

// Business hours the week grid shows, matching OfferTimesCalendar's window.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const DAYS_IN_WEEK = 7;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(base) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay()); // back to Sunday
  return date;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The signed-in user's private calendar: their own confirmed meetings on a
 * read-only week grid (built the same way as OfferTimesCalendar). Each meeting
 * block links to its detail page and carries "add to Google / Apple" buttons.
 * Private by construction — GET /meetings only ever returns the caller's own.
 */
export default function MeetingCalendar() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [state, setState] = useState("loading");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    apiClient
      .get("/meetings")
      .then(({ data }) => {
        setMeetings(data);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  const scheduled = useMemo(
    () =>
      meetings
        .filter((m) => m.status === MEETING_STATUS.SCHEDULED && m.scheduledTime)
        .map((m) => ({ ...m, start: new Date(m.scheduledTime) })),
    [meetings]
  );

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * DAYS_IN_WEEK);
    return base;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
      }),
    [weekStart]
  );

  const hourRows = useMemo(() => {
    const rows = [];
    for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour += 1) rows.push(hour);
    return rows;
  }, []);

  if (state === "loading") {
    return (
      <Container sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }
  if (state === "error") {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Your calendar could not be loaded.</Alert>
      </Container>
    );
  }

  const meetingsFor = (day, hour) =>
    scheduled.filter((m) => sameDay(m.start, day) && m.start.getHours() === hour);

  // Confirmed meetings that fall outside the 08:00–20:00 grid, so nothing hides.
  const offGrid = scheduled.filter(
    (m) => m.start.getHours() < DAY_START_HOUR || m.start.getHours() >= DAY_END_HOUR
  );

  const rangeLabel = `${days[0].toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography variant="h3" gutterBottom>
        My calendar
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Your confirmed meetings. Add any of them to Google or Apple Calendar.
      </Typography>

      {scheduled.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have no scheduled meetings yet. Once a meeting is confirmed it appears here.
        </Alert>
      )}

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button
          onClick={() => setWeekOffset((value) => value - 1)}
        >
          ← Previous week
        </Button>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, textAlign: "center" }}>
          {rangeLabel}
        </Typography>
        <Button onClick={() => setWeekOffset((value) => value + 1)}>Next week →</Button>
      </Stack>

      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 720 }}>
          {/* Header: blank gutter + day columns */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "64px repeat(7, 1fr)",
              bgcolor: "action.hover",
            }}
          >
            <Box />
            {days.map((day) => (
              <Box key={day.toISOString()} sx={{ p: 1, textAlign: "center" }}>
                <Typography variant="caption" display="block">
                  {DAY_LABELS[day.getDay()]}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {day.getDate()}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Hour rows */}
          {hourRows.map((hour) => (
            <Box
              key={hour}
              sx={{
                display: "grid",
                gridTemplateColumns: "64px repeat(7, 1fr)",
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Box sx={{ p: 1, textAlign: "right", pr: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {String(hour).padStart(2, "0")}:00
                </Typography>
              </Box>
              {days.map((day) => {
                const cellMeetings = meetingsFor(day, hour);
                return (
                  <Box
                    key={`${day.toISOString()}-${hour}`}
                    sx={{
                      minHeight: 44,
                      p: 0.5,
                      borderLeft: 1,
                      borderColor: "divider",
                    }}
                  >
                    {cellMeetings.map((m) => {
                      const iAmMentor = m.mentorId === user.id;
                      const other = iAmMentor ? m.mentee : m.mentor;
                      const name = other?.fullName || other?.username || "a member";
                      return (
                        <Tooltip
                          key={m.id}
                          title={`${m.start.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })} · ${iAmMentor ? "mentoring" : "with"} ${name}`}
                        >
                          <Chip
                            component={Link}
                            to={`/meetings/${m.id}`}
                            clickable
                            size="small"
                            color="success"
                            label={`${m.start.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} ${name}`}
                            sx={{ maxWidth: "100%", mb: 0.5 }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      {offGrid.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Outside 08:00–20:00
          </Typography>
          <Stack spacing={1}>
            {offGrid.map((m) => {
              const iAmMentor = m.mentorId === user.id;
              const other = iAmMentor ? m.mentee : m.mentor;
              const name = other?.fullName || other?.username || "a member";
              return (
                <Paper key={m.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Button component={Link} to={`/meetings/${m.id}`} sx={{ justifyContent: "flex-start" }}>
                    {m.start.toLocaleString()} · {iAmMentor ? "mentoring" : "with"} {name}
                  </Button>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      {scheduled.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Add your meetings to a calendar
          </Typography>
          <Stack spacing={1}>
            {scheduled
              .slice()
              .sort((a, b) => a.start - b.start)
              .map((m) => {
                const iAmMentor = m.mentorId === user.id;
                const other = iAmMentor ? m.mentee : m.mentor;
                const name = other?.fullName || other?.username || "a member";
                return (
                  <Paper key={m.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      alignItems={{ sm: "center" }}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {iAmMentor ? "Mentoring" : "With"} {name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.start.toLocaleString()}
                        </Typography>
                      </Box>
                      <AddToCalendarButtons meeting={m} />
                    </Stack>
                  </Paper>
                );
              })}
          </Stack>
        </Box>
      )}
    </Container>
  );
}
