import React from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Container, Paper, Stack, Typography } from "@mui/material";

export default function MeetingHubPage() {
  const { id } = useParams();

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: "16px",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "#FFF0F6",
        }}
      >
        <Typography variant="h3" color="primary" gutterBottom>
          Your meeting
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Pick the step that matches where you are in this mentoring meeting.
        </Typography>
        <Stack spacing={2}>
          <Button
            component={Link}
            to={`/meetings/${id}/arrival`}
            variant="contained"
            size="large"
          >
            Confirm arrival
          </Button>
          <Button
            component={Link}
            to={`/meetings/${id}/outcome`}
            variant="outlined"
            color="secondary"
            size="large"
          >
            Share meeting outcome
          </Button>
          <Button
            component={Link}
            to={`/meetings/${id}/feedback`}
            variant="outlined"
            color="secondary"
            size="large"
          >
            Leave feedback
          </Button>
          <Button component={Link} to="/" color="primary">
            Back home
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
