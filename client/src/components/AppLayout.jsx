import React from "react";
import {
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
import NotificationBell from "../notifications/NotificationBell";

export default function AppLayout() {
  const { user, logout } = useAuth();

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
          <Button color="inherit" onClick={logout}>
            Log out
          </Button>
          <NotificationBell />
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: { xs: 2, md: 4 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
