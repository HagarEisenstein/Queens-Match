import React, { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";
import NotificationBell from "../notifications/NotificationBell";
import LocaleToggle from "./LocaleToggle";

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
    fontWeight: 600,
    borderRadius: 2,
    px: 1.5,
    "&:hover": { bgcolor: "primary.light", color: "common.white" },
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1.5, flexWrap: "wrap", py: 1 }}>
          <Typography
            component={Link}
            to="/"
            variant="h6"
            sx={{
              flexGrow: 1,
              textDecoration: "none",
              color: "primary.main",
              fontFamily: '"Sunday", "Fredoka", "Nunito", sans-serif',
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            Queens Match
          </Typography>

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
                  borderColor: "primary.main",
                  bgcolor: "rgba(255, 125, 156, 0.08)",
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
          <Button component={Link} to="/profile" sx={navLinkSx}>
            Profile
          </Button>
          {hasRole("mentor") && (
            <Button color="inherit" component={Link} to="/mentor-profile" sx={navLinkSx}>
              Mentor Profile
            </Button>
          )}
          {hasRole("admin") && (
            <Button component={Link} to="/admin" sx={navLinkSx}>Admin</Button>
          )}
          <LocaleToggle
            sx={{
              ...navLinkSx,
              minWidth: 48,
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
            }}
          />
          <Button component={Link} to="/meetings" sx={navLinkSx}>
            Meetings
          </Button>
          <Button color="inherit" onClick={logout} sx={navLinkSx}>
            Log out
          </Button>
          <NotificationBell />
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

      <Box component="main" sx={{ p: { xs: 2, md: 4 }, flex: 1 }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          mt: "auto",
          bgcolor: "#FFFFFF",
          borderTop: "1px solid",
          borderColor: "divider",
          pt: 3,
          pb: 0,
        }}
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
                color: "primary.main",
                fontFamily: '"Sunday", "Fredoka", "Nunito", sans-serif',
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              Queens Match
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {hasRole("mentee") && (
                <Button component={Link} to="/mentors" size="small" sx={{ color: "secondary.main" }}>
                  Discover
                </Button>
              )}
              <Button component={Link} to="/matches" size="small" sx={{ color: "secondary.main" }}>
                Matches
              </Button>
              <Button component={Link} to="/profile" size="small" sx={{ color: "secondary.main" }}>
                Profile
              </Button>
            </Stack>
          </Stack>
        </Container>
        <Box
          aria-hidden
          sx={{
            height: 8,
            background:
              "linear-gradient(90deg, #FF7D9C 0%, #FFB4C6 25%, #FFE08A 50%, #715CF3 75%, #FF7D9C 100%)",
          }}
        />
      </Box>
    </Box>
  );
}
