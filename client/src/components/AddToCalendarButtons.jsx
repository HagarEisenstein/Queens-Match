import React from "react";
import { Button, Stack } from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import DownloadIcon from "@mui/icons-material/Download";
import { useAuth } from "../auth/AuthContext";
import { googleCalendarUrl, downloadIcs } from "../meetings/calendarLinks";

/**
 * Two buttons that add a confirmed meeting to the viewer's real calendar:
 * "Add to Google" opens a prefilled Google Calendar event, and "Apple / .ics"
 * downloads an iCalendar file that opens in Apple Calendar (or Outlook, etc.).
 * Both derive everything client-side from the meeting the viewer already holds.
 */
export default function AddToCalendarButtons({ meeting, size = "small" }) {
  const { user } = useAuth();

  if (!meeting?.scheduledTime) return null;

  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      <Button
        size={size}
        variant="outlined"
        startIcon={<EventIcon />}
        component="a"
        href={googleCalendarUrl(meeting, user.id)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Add to Google
      </Button>
      <Button
        size={size}
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={() => downloadIcs(meeting, user.id)}
      >
        Apple / .ics
      </Button>
    </Stack>
  );
}
