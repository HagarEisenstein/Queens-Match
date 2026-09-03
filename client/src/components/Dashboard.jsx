import React from "react";
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Dashboard() {
  const { user } = useAuth();

  return (
    <Box maxWidth="md" mx="auto">
      <Typography variant="h4" gutterBottom>
        Welcome, {user.username}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Find a mentor who can help you take your next step.
      </Alert>
      <Button component={Link} to="/mentors" variant="contained" sx={{ mb: 3 }}>
        Browse mentors
      </Button>
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
