import React from "react";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";

function Dashboard() {
  const { user } = useAuth();

  return (
    <Box maxWidth="md" mx="auto">
      <Typography variant="h4" gutterBottom>
        Welcome, {user.username}
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        This account keeps all of its capabilities in one session.
      </Alert>
      <Stack spacing={2}>
        {user.roles.map((role) => (
          <Card key={role} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ textTransform: "capitalize" }}>
                {role} access
              </Typography>
              <Typography color="text.secondary">
                Your {role} capability is active. Related features will appear
                here as their epics are implemented.
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

export default Dashboard;
