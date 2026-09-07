import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";

function Dashboard() {
  const { user, hasRole } = useAuth();
  const [mentorProfileMissing, setMentorProfileMissing] = useState(false);

  useEffect(() => {
    if (!hasRole("mentor")) {
      setMentorProfileMissing(false);
      return undefined;
    }

    let active = true;
    apiClient
      .get("/mentors/me")
      .then(({ data }) => {
        if (active) setMentorProfileMissing(!data);
      })
      .catch(() => {
        if (active) setMentorProfileMissing(false);
      });

    return () => {
      active = false;
    };
  }, [hasRole, user]);

  const isBoth = hasRole("mentor") && hasRole("mentee");

  return (
    <Box className="qm-dashboard" sx={{ maxWidth: 1280, mx: "auto", py: { xs: 2, md: 6 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.05fr .95fr" },
          gap: { xs: 5, md: 8 },
          alignItems: "center",
          minHeight: { md: 480 },
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ letterSpacing: ".18em", fontWeight: 700 }}>
            QUEENS MATCH · YOUR NEXT CHAPTER
          </Typography>
          <Typography
            component="h1"
            sx={{
              mt: 2,
              mb: 3,
              maxWidth: 650,
              fontFamily: '"Space Mono", "Courier New", monospace',
              fontSize: { xs: "3.2rem", sm: "4.6rem", md: "5.7rem" },
              lineHeight: .98,
              letterSpacing: "-.09em",
            }}
          >
            Welcome,
            <br />
            {user.username}.
          </Typography>
          <Typography sx={{ maxWidth: 480, color: "text.secondary", fontSize: "1.08rem", lineHeight: 1.7 }}>
            {hasRole("mentee")
              ? "Find a mentor who can help you take your next step."
              : "Keep your mentor profile up to date so mentees can discover you."}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 3, mb: 3 }} flexWrap="wrap" useFlexGap>
            {isBoth ? (
              <>
                <Chip label="Mentoring" sx={{ bgcolor: "#FFD6E2" }} />
                <Chip label="Learning" color="secondary" variant="outlined" />
              </>
            ) : (
              user.roles.map((role) => (
                <Chip key={role} label={role} sx={{ bgcolor: "#FFD6E2", textTransform: "capitalize" }} />
              ))
            )}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {hasRole("mentee") && (
              <Button component={Link} to="/mentors" variant="contained" size="large">
                Browse mentors →
              </Button>
            )}
            {hasRole("mentor") && (
              <Button component={Link} to="/mentor-profile" variant={mentorProfileMissing ? "contained" : "outlined"} color={mentorProfileMissing ? "warning" : "secondary"} size="large">
                {mentorProfileMissing ? "Complete mentor profile" : "Edit mentor profile"}
              </Button>
            )}
          </Stack>
        </Box>

        <Box className="qm-dashboard-art" sx={{ position: "relative", minHeight: 420, display: "grid", placeItems: "center" }}>
          <Box sx={{ position: "absolute", width: "74%", height: "74%", borderRadius: "48% 52% 58% 42%", bgcolor: "#FFD6E2", transform: "rotate(-12deg)" }} />
          <Box sx={{ position: "absolute", width: "68%", height: "68%", borderRadius: "55% 45% 42% 58%", bgcolor: "#FA9797", transform: "rotate(23deg)" }} />
          <Card sx={{ position: "relative", width: "min(100%, 410px)", p: { xs: 2, md: 3 }, transform: "rotate(3deg)" }}>
            <CardContent sx={{ p: "8px !important" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography sx={{ fontFamily: '"Space Mono", monospace', fontSize: 14 }}>YOUR SPACE</Typography>
                <Box sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: "#202124", color: "#fff", display: "grid", placeItems: "center", fontSize: 13 }}>✦</Box>
              </Stack>
              <Typography variant="h5" sx={{ mb: 1 }}>Make room<br />for good work.</Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>Small conversations can open big doors.</Typography>
              <Divider sx={{ borderColor: "#202124", mb: 2 }} />
              <Stack direction="row" justifyContent="space-between">
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {hasRole("mentor") && mentorProfileMissing && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Your mentor profile is incomplete. Add your background and topics so mentees can discover you.
        </Alert>
      )}

      <Box sx={{ mt: { xs: 5, md: 9 }, pt: 3, borderTop: "1px solid", borderColor: "divider", display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 3 }}>
        <Box><Typography variant="h6">01</Typography><Typography color="text.secondary">Discover people who get where you want to go.</Typography></Box>
        <Box><Typography variant="h6">02</Typography><Typography color="text.secondary">Start a thoughtful conversation at your pace.</Typography></Box>
        <Box><Typography variant="h6">03</Typography><Typography color="text.secondary">Turn one meeting into your next move.</Typography></Box>
      </Box>
    </Box>
  );
}

export default Dashboard;
