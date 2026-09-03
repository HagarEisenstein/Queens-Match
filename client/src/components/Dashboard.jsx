import React from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button
} from "@mui/material";
import { Link } from "react-router-dom";

function Dashboard() {
  return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              👑 Queens Match
            </Typography>
            <Button color="inherit" component={Link} to="/mentors">Find a mentor</Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom>Welcome to Queens Match</Typography>
          <Typography color="text.secondary">Find a mentor who can help you take your next step.</Typography>
          <Button component={Link} to="/mentors" variant="contained" sx={{ mt: 3 }}>Browse mentors</Button>
        </Box>
      </Box>
  );
}

export default Dashboard;
