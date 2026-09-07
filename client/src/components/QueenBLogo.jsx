import React from "react";
import { Box } from "@mui/material";

export default function QueenBLogo({
  variant = "icon",
  width,
  height,
  sx,
}) {
  if (variant === "wordmark") {
    return (
      <Box
        aria-label="QueenB logo"
        component="svg"
        role="img"
        viewBox="0 0 187 111"
        sx={{
          width: width || 187,
          height: height || "auto",
          display: "block",
          flexShrink: 0,
          ...sx,
        }}
      >
        <path
          d="M23 55V43c0-7 4-13 9-17 4-3 9-5 14-5h42c6 0 11-2 15-6l6-7 6 7c4 4 9 6 15 6h11c12 0 22 10 22 22v12"
          fill="none"
          stroke="#d63378"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="18"
          y="98"
          fill="#d63378"
          fontFamily="Georgia, serif"
          fontSize="43"
          fontWeight="700"
        >
          QueenB
        </text>
      </Box>
    );
  }

  return (
    <Box
      aria-label="QueenB logo"
      role="img"
      sx={{
        width: width || 42,
        height: height || 42,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...sx,
      }}
    >
      <svg viewBox="0 0 48 48" width="42" height="42" aria-hidden="true">
        <circle cx="24" cy="24" r="21" fill="#fff2f7" />
        <path d="M14 23c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10-10 10-10-4.5-10-10Z" fill="#202124" />
        <path d="M18 17.5h12v3H18Zm-2 5h16v3H16Zm2 5h12v3H18Z" fill="#f4a0b7" />
        <path d="M16.5 14c-3.2 0-5.5 2.9-5.5 5.7 2.6 0 5.7-1.2 7.6-3.7-.4-1.1-1.1-2-2.1-2Zm15 2c1.9 2.5 5 3.7 7.6 3.7 0-2.8-2.3-5.7-5.5-5.7-1 0-1.7.9-2.1 2Z" fill="#fffdfd" />
        <circle cx="31.5" cy="23" r="1.3" fill="#fff2f7" />
      </svg>
    </Box>
  );
}
