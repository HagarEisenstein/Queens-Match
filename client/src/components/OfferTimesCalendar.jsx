import React, { useMemo, useState } from "react";
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";

// Business hours the mentor can offer within, in local time.
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

function keyFor(date) {
  return date.toISOString();
}

/**
 * A week-grid calendar for a mentor to mark available times [R4.3]. Clicking a
 * cell toggles a proposed slot; each slot runs from the clicked time for the
 * mentor's configured meeting length. Selections persist as the mentor pages
 * between weeks, and `onSubmit` receives them as `{ startTime, endTime }` ISO
 * pairs. Purely presentational — it does not know about the state machine.
 */
export default function OfferTimesCalendar({ meetingLengthMinutes = 30, onSubmit, submitting }) {
  const stepMinutes = Math.min(Math.max(meetingLengthMinutes, 15), 120);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState({}); // key: ISO start → { startTime, endTime }

  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => {
    const base = startOfWeek(now);
    base.setDate(base.getDate() + weekOffset * DAYS_IN_WEEK);
    return base;
  }, [now, weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + index);
        return day;
      }),
    [weekStart]
  );

  // Start times of the day, spaced by the meeting length, that still fit before close.
  const rowStarts = useMemo(() => {
    const rows = [];
    const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60;
    for (let offset = 0; offset + stepMinutes <= totalMinutes; offset += stepMinutes) {
      const hour = DAY_START_HOUR + Math.floor(offset / 60);
      const minute = offset % 60;
      rows.push({ hour, minute });
    }
    return rows;
  }, [stepMinutes]);

  const toggle = (day, { hour, minute }) => {
    const start = new Date(day);
    start.setHours(hour, minute, 0, 0);
    if (start.getTime() <= now.getTime()) return; // no offering the past
    const end = new Date(start.getTime() + meetingLengthMinutes * 60 * 1000);
    const key = keyFor(start);
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = { startTime: start.toISOString(), endTime: end.toISOString() };
      return next;
    });
  };

  const selectedList = useMemo(
    () => Object.values(selected).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [selected]
  );

  const remove = (startTime) =>
    setSelected((current) => {
      const next = { ...current };
      delete next[startTime];
      return next;
    });

  const rangeLabel = `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button onClick={() => setWeekOffset((value) => Math.max(0, value - 1))} disabled={weekOffset === 0}>
          ← Previous week
        </Button>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, textAlign: "center" }}>{rangeLabel}</Typography>
        <Button onClick={() => setWeekOffset((value) => value + 1)}>Next week →</Button>
      </Stack>

      <Paper variant="outlined" sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 640 }}>
          {/* Header: blank gutter + day columns */}
          <Box sx={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", bgcolor: "action.hover" }}>
            <Box />
            {days.map((day) => (
              <Box key={keyFor(day)} sx={{ p: 1, textAlign: "center" }}>
                <Typography variant="caption" display="block">{DAY_LABELS[day.getDay()]}</Typography>
                <Typography variant="body2" fontWeight={600}>{day.getDate()}</Typography>
              </Box>
            ))}
          </Box>

          {/* Time rows */}
          {rowStarts.map((row) => (
            <Box
              key={`${row.hour}:${row.minute}`}
              sx={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderTop: 1, borderColor: "divider" }}
            >
              <Box sx={{ p: 1, textAlign: "right", pr: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {String(row.hour).padStart(2, "0")}:{String(row.minute).padStart(2, "0")}
                </Typography>
              </Box>
              {days.map((day) => {
                const start = new Date(day);
                start.setHours(row.hour, row.minute, 0, 0);
                const key = keyFor(start);
                const isPast = start.getTime() <= now.getTime();
                const isSelected = Boolean(selected[key]);
                return (
                  <Box
                    key={key}
                    role="button"
                    aria-pressed={isSelected}
                    aria-disabled={isPast}
                    onClick={() => toggle(day, row)}
                    sx={{
                      height: 34,
                      borderLeft: 1,
                      borderColor: "divider",
                      cursor: isPast ? "not-allowed" : "pointer",
                      bgcolor: isSelected ? "primary.main" : isPast ? "action.disabledBackground" : "transparent",
                      opacity: isPast ? 0.5 : 1,
                      transition: "background-color 120ms",
                      "&:hover": { bgcolor: isPast ? undefined : isSelected ? "primary.dark" : "action.selected" },
                    }}
                  />
                );
              })}
            </Box>
          ))}
        </Box>
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Selected times ({selectedList.length})
        </Typography>
        {selectedList.length === 0 ? (
          <Typography color="text.secondary">Click cells above to propose times.</Typography>
        ) : (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedList.map((slot) => (
              <Chip
                key={slot.startTime}
                label={new Date(slot.startTime).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                onDelete={() => remove(slot.startTime)}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Button
        variant="contained"
        size="large"
        sx={{ mt: 3 }}
        disabled={selectedList.length === 0 || submitting}
        onClick={() => onSubmit(selectedList)}
      >
        {submitting ? "Sending…" : `Offer ${selectedList.length} time${selectedList.length === 1 ? "" : "s"}`}
      </Button>
    </Box>
  );
}
