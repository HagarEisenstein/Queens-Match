import React, { useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Box,
  Button,
  Drawer,
  Fab,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function MentorSearchAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <>
      <Fab
        variant="extended"
        color="secondary"
        aria-label="Help me find a mentor"
        onClick={() => setIsOpen(true)}
        sx={{
          position: "fixed",
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: (theme) => theme.zIndex.speedDial,
          px: { xs: 2, sm: 2.5 },
          boxShadow: 3,
          textTransform: "none",
          fontWeight: 600,
        }}
      >
        <AutoAwesomeRoundedIcon sx={{ mr: 1 }} />
        Help me find a mentor
      </Fab>

      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        PaperProps={{
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": "mentor-search-title",
          "aria-describedby": "mentor-search-description",
          sx: {
            width: { xs: "100%", sm: 400 },
            maxWidth: "100vw",
            borderRadius: { xs: 0, sm: "16px 0 0 16px" },
          },
        }}
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            p: { xs: 2.5, sm: 3 },
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 1.5 }}
          >
            <Typography id="mentor-search-title" variant="h5" color="primary">
              Find your mentor
            </Typography>
            <IconButton
              aria-label="Close mentor search"
              onClick={() => setIsOpen(false)}
              edge="end"
            >
              <CloseRoundedIcon />
            </IconButton>
          </Stack>

          <Typography
            id="mentor-search-description"
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            Describe what kind of help you’re looking for, and we’ll use it to
            find relevant mentors.
          </Typography>

          <TextField
            label="What kind of help do you need?"
            placeholder="I’m looking for someone who can help me prepare for a backend interview and review my CV"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            multiline
            minRows={5}
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            disabled={!searchText.trim()}
            sx={{ mt: 2 }}
          >
            Find mentors
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
