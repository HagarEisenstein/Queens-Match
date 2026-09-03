import React, { useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import apiClient from "../api/client";
import NotificationBell from "../notifications/NotificationBell";

export default function AppLayout() {
  const { user, logout, hasRole } = useAuth();
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Queens Match
          </Typography>
          <Stack direction="row" spacing={1} aria-label="Account capabilities">
            {user.roles.map((role) => (
              <Chip
                key={role}
                label={role}
                size="small"
                sx={{ color: "white", borderColor: "white" }}
                variant="outlined"
              />
            ))}
          </Stack>
          <Button color="inherit" component={Link} to="/">
            Home
          </Button>
          <Button color="inherit" component={Link} to="/profile">
            Profile
          </Button>
          <Button color="inherit" component={Link} to="/mentors">
            Mentors
          </Button>
          {hasRole("mentor") && (
            <Button color="inherit" component={Link} to="/mentor-profile">
              Mentor Profile
            </Button>
          )}
          <Button color="inherit" onClick={logout}>
            Log out
          </Button>
          <NotificationBell />
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
      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
