import React, { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";
import NotificationBell from "../notifications/NotificationBell";
import QueenBLogo from "./QueenBLogo";

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const [mentorProfileMissing, setMentorProfileMissing] = useState(null);

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

  if (
    hasRole("mentor") &&
    mentorProfileMissing &&
    location.pathname !== "/mentor-profile" &&
    !location.pathname.startsWith("/admin")
  ) {
    return <Navigate to="/mentor-profile" replace />;
  }

  const displayName = user.full_name || user.username || "?";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navLinkSx = {
    color: "text.primary",
    fontWeight: 500,
    borderRadius: 2,
    px: 1.25,
    minHeight: 36,
    "&:hover": { bgcolor: "secondary.light", color: "common.black" },
  };
  const profileActive = location.pathname === "/profile";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box className="qm-bee" aria-hidden="true">
        <span className="qm-bee__trail" />
        <span className="qm-bee__wing qm-bee__wing--one" />
        <span className="qm-bee__wing qm-bee__wing--two" />
        <span className="qm-bee__body" />
        <span className="qm-bee__eye" />
      </Box>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: "wrap", py: 1.5, px: { xs: 2, md: 5 }, maxWidth: 1440, width: "100%", mx: "auto" }}>
          <Stack
            component={Link}
            to="/"
            sx={{
              flexGrow: 1,
              minWidth: 0,
              textDecoration: "none",
              color: "text.primary",
            }}
            direction="row"
            spacing={1.25}
            alignItems="center"
          >
            <QueenBLogo />
            <Typography
              variant="h6"
              sx={{
                textDecoration: "none",
                color: "text.primary",
                fontFamily: '"Space Mono", "Courier New", monospace',
                fontWeight: 700,
                letterSpacing: "-.06em",
                whiteSpace: "nowrap",
              }}
            >
              Queen's Match
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.5} aria-label="Account capabilities">
            {user.roles.map((role) => (
              <Chip
                key={role}
                label={
                  role === "mentor" && mentorProfileMissing
                    ? "mentor setup pending"
                    : role
                }
                size="small"
                color="primary"
                variant="outlined"
                sx={{
                  borderColor: "text.primary",
                  bgcolor: "secondary.light",
                }}
              />
            ))}
          </Stack>

          {hasRole("mentee") && (
            <Button component={Link} to="/mentors" sx={navLinkSx}>
              Discover
            </Button>
          )}
          <Button component={Link} to="/matches" sx={navLinkSx}>
            Matches
          </Button>
          {hasRole("mentor") && (
            <Button color="inherit" component={Link} to="/mentor-profile" sx={navLinkSx}>
              Mentor Profile
            </Button>
          )}
          {hasRole("admin") && (
            <Button component={Link} to="/admin" sx={navLinkSx}>Admin</Button>
          )}
          <Button component={Link} to="/meetings" sx={navLinkSx}>
            Meetings
          </Button>
          <Button component={Link} to="/calendar" sx={navLinkSx}>
            Calendar
          </Button>
          <Button color="inherit" onClick={logout} sx={navLinkSx}>
            Log out
          </Button>
          <NotificationBell />
          <IconButton
            component={Link}
            to="/profile"
            aria-label="Open profile"
            sx={{
              p: 0.25,
              border: "2px solid",
              borderColor: profileActive ? "primary.main" : "transparent",
              "&:hover": {
                bgcolor: "rgba(255, 125, 156, 0.08)",
              },
            }}
          >
            <Avatar
              src={user.photo_url || undefined}
              alt={displayName}
              sx={{
                width: 36,
                height: 36,
                bgcolor: "primary.main",
                fontSize: 14,
                border: "2px solid",
                borderColor: "primary.light",
              }}
            >
              {initials}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      {hasRole("mentor") && mentorProfileMissing && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" component={Link} to="/mentor-profile">
              Complete mentor profile
            </Button>
          }
        >
          Complete mentor profile so mentees can find you.
        </Alert>
      )}

      <Box component="main" sx={{ p: { xs: 2, sm: 3, md: 5 }, flex: 1, width: "100%", maxWidth: 1440, mx: "auto" }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{ mt: "auto", bgcolor: "transparent", borderTop: "1px solid", borderColor: "divider", pt: 3, pb: 0 }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            sx={{ pb: 2 }}
          >
            <Typography
              sx={{
                color: "text.primary",
                fontFamily: '"Space Mono", "Courier New", monospace',
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              Queen's Match
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              For help contact: 055-9384923
            </Typography>
          </Stack>
        </Container>
        <Box
          aria-hidden
          sx={{
            height: 5,
            background: "#202124",
          }}
        />
      </Box>
    </Box>
  );
}
