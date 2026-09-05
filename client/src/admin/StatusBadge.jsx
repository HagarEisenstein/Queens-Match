import React from "react";
import { Chip } from "@mui/material";
import { statusColor, statusLabel } from "./meetingStatus";

export default function StatusBadge({ status }) {
  const color = statusColor(status);
  return (
    <Chip
      size="small"
      label={statusLabel(status)}
      sx={{
        bgcolor: color,
        color: "#fff",
        fontWeight: 600,
      }}
    />
  );
}
