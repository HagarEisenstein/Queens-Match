import React, { useState } from "react";
import {
  Alert,
  Button,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useParams } from "react-router-dom";
import apiClient from "../api/client";

export default function MeetingOutcomePage() {
  const { id } = useParams();
  const [happened, setHappened] = useState("true");
  const [absentParty, setAbsentParty] = useState("unclear");
  const [stillWantToMeet, setStillWantToMeet] = useState("true");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    setError("");
    const didHappen = happened === "true";
    try {
      await apiClient.put(`/engagement/meetings/${id}/outcome`, {
        happened: didHappen,
        absentParty: didHappen ? null : absentParty,
        stillWantToMeet: didHappen ? null : stillWantToMeet === "true",
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err.response?.data?.error?.message || "Could not save outcome.");
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom>
        Meeting outcome
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Tell us whether this mentoring meeting happened.
      </Typography>
      {status === "saved" && <Alert severity="success" sx={{ mb: 2 }}>Outcome saved.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack component="form" onSubmit={submit} spacing={3}>
        <FormControl>
          <FormLabel>Did the meeting happen?</FormLabel>
          <RadioGroup
            row
            value={happened}
            onChange={(event) => setHappened(event.target.value)}
          >
            <FormControlLabel value="true" control={<Radio />} label="Yes" />
            <FormControlLabel value="false" control={<Radio />} label="No" />
          </RadioGroup>
        </FormControl>
        {happened === "false" && (
          <>
            <TextField
              select
              label="Who was absent?"
              value={absentParty}
              onChange={(event) => setAbsentParty(event.target.value)}
            >
              <MenuItem value="self">Me</MenuItem>
              <MenuItem value="other">The other person</MenuItem>
              <MenuItem value="both">Both of us</MenuItem>
              <MenuItem value="unclear">Unclear</MenuItem>
            </TextField>
            <FormControl>
              <FormLabel>Still want to meet?</FormLabel>
              <RadioGroup
                row
                value={stillWantToMeet}
                onChange={(event) => setStillWantToMeet(event.target.value)}
              >
                <FormControlLabel value="true" control={<Radio />} label="Yes" />
                <FormControlLabel value="false" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>
          </>
        )}
        <Button type="submit" variant="contained" disabled={status === "saving"}>
          Submit outcome
        </Button>
      </Stack>
    </Container>
  );
}
