import React, { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
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

  return (
    <Box maxWidth="md" mx="auto">
      <Typography variant="h4" gutterBottom>
        Welcome, {user.username}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Find a mentor who can help you take your next step.
      </Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Button component={Link} to="/mentors" variant="contained">
          Browse mentors
        </Button>
        {hasRole("mentor") && (
          <Button
            component={Link}
            to="/mentor-profile"
            variant={mentorProfileMissing ? "contained" : "outlined"}
            color={mentorProfileMissing ? "warning" : "primary"}
          >
            {mentorProfileMissing ? "Complete mentor profile" : "Edit mentor profile"}
          </Button>
        )}
      </Stack>
      {hasRole("mentor") && mentorProfileMissing && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Your mentor profile is incomplete. Add your background and topics so mentees can discover you.
        </Alert>
      )}
      <Stack spacing={2}>
        {user.roles.map((role) => (
          <Card key={role} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ textTransform: "capitalize" }}>
                {role} access
              </Typography>
              <Typography color="text.secondary">
                Your {role} capability is active.
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default Dashboard;
