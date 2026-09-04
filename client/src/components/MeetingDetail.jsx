import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from "@mui/material";
import apiClient from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { MEETING_STATUS, statusMeta, statusPrompt } from "../meetings/meetingStatus";
import OfferTimesCalendar from "./OfferTimesCalendar";

export default function MeetingDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosenSlot, setChosenSlot] = useState("");
  const [meetingLength, setMeetingLength] = useState(30);

  const load = useCallback(() => {
    apiClient
      .get(`/meetings/${id}`)
      .then(({ data }) => {
        setMeeting(data);
        setState("ready");
      })
      .catch((loadError) => setState(loadError.response?.status === 404 ? "missing" : "error"));
  }, [id]);

  useEffect(() => load(), [load]);

  const iAmMentor = meeting && meeting.mentorId === user.id;
  const iAmMentee = meeting && meeting.menteeId === user.id;

  // When the mentor needs to offer times, load their meeting length for the grid.
  useEffect(() => {
    if (iAmMentor && meeting?.status === MEETING_STATUS.PENDING_MENTOR_TIMES) {
      apiClient
        .get("/mentors/me")
        .then(({ data }) => {
          if (data?.meetingLengthMinutes) setMeetingLength(data.meetingLengthMinutes);
        })
        .catch(() => {});
    }
  }, [iAmMentor, meeting?.status]);

  const runAction = async (fn) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await fn();
      setMeeting(data);
    } catch (actionError) {
      setError(actionError.response?.data?.error?.message || "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const offerTimes = (slots) => runAction(() => apiClient.post(`/meetings/${id}/offer-times`, { slots }));
  const reject = () => runAction(() => apiClient.post(`/meetings/${id}/reject`));
  const selectTime = () => runAction(() => apiClient.post(`/meetings/${id}/select-time`, { slotId: chosenSlot }));
  const requestMoreTimes = () => runAction(() => apiClient.post(`/meetings/${id}/request-more-times`));
  const declineOfferedTimes = () => runAction(() => apiClient.post(`/meetings/${id}/decline`));
  const cantMakeIt = () => runAction(() => apiClient.post(`/meetings/${id}/cant-make-it`));

  if (state === "loading") return <Container sx={{ py: 6, textAlign: "center" }}><CircularProgress /></Container>;
  if (state === "missing") return <Container sx={{ py: 4 }}><Alert severity="warning">Meeting not found.</Alert></Container>;
  if (state === "error") return <Container sx={{ py: 4 }}><Alert severity="error">This meeting could not be loaded.</Alert></Container>;

  const role = iAmMentor ? "mentor" : "mentee";
  const other = iAmMentor ? meeting.mentee : meeting.mentor;
  const meta = statusMeta(meeting.status);

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Button component={Link} to="/meetings" sx={{ mb: 3 }}>← All meetings</Button>

      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }} flexWrap="wrap">
        <Typography variant="h4">
          {iAmMentor ? "Mentoring" : "Meeting with"} {other?.fullName || other?.username || "a member"}
        </Typography>
        <Chip label={meta.label} color={meta.color} />
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>{statusPrompt(meeting.status, role)}</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Confirmed meeting */}
      {meeting.status === MEETING_STATUS.SCHEDULED && (
        <>
          <Alert severity="success" sx={{ mb: 2 }}>
            Confirmed for {new Date(meeting.scheduledTime).toLocaleString()}.
          </Alert>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Can't make it?</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {meeting.rescheduleUsed
                ? "This meeting was already rescheduled once. Flagging it again will cancel it — there are no more retries."
                : "Let the other side know so you can pick a new time together. This can only be done once — a second time cancels the meeting."}
            </Typography>
            <Button color="warning" variant="outlined" onClick={cantMakeIt} disabled={busy}>
              {meeting.rescheduleUsed ? "Cancel this meeting" : "I can't make it"}
            </Button>
          </Paper>
        </>
      )}

      {/* Rejected */}
      {meeting.status === MEETING_STATUS.REJECTED && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {iAmMentee
            ? "This request was declined. You're welcome to request another mentor."
            : "You declined this request."}
        </Alert>
      )}

      {/* Cancelled */}
      {meeting.status === MEETING_STATUS.CANCELLED && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This meeting was cancelled after a second scheduling conflict. You're welcome to request another meeting.
        </Alert>
      )}

      {/* Mentor: offer times or reject */}
      {iAmMentor && meeting.status === MEETING_STATUS.PENDING_MENTOR_TIMES && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Offer available times</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Each proposed slot is {meetingLength} minutes long. Pick as many as you like, then send them over.
          </Typography>
          <OfferTimesCalendar meetingLengthMinutes={meetingLength} onSubmit={offerTimes} submitting={busy} />
          <Divider sx={{ my: 3 }} />
          <Button color="error" variant="outlined" onClick={reject} disabled={busy}>
            Decline this request
          </Button>
        </Paper>
      )}

      {/* Mentee: pick exactly one offered time */}
      {iAmMentee && meeting.status === MEETING_STATUS.PENDING_MENTEE_SELECTION && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Choose a time</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Pick exactly one of the times your mentor offered.</Typography>
          <RadioGroup value={chosenSlot} onChange={(event) => setChosenSlot(event.target.value)}>
            {meeting.timeSlots.map((slot) => (
              <FormControlLabel
                key={slot.id}
                value={slot.id}
                control={<Radio />}
                label={`${new Date(slot.startTime).toLocaleString()} – ${new Date(slot.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              />
            ))}
          </RadioGroup>
          <Button variant="contained" sx={{ mt: 2 }} disabled={!chosenSlot || busy} onClick={selectTime}>
            Confirm this time
          </Button>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>None of these work for you?</Typography>
          {meeting.moreTimesUsed ? (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                You already asked for more times once. If none of these work either, you'll need to decline.
              </Typography>
              <Button color="error" variant="outlined" onClick={declineOfferedTimes} disabled={busy}>
                Decline — none of these work for me
              </Button>
            </>
          ) : (
            <>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                You can ask your mentor for a fresh set of times once, or decline outright.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" onClick={requestMoreTimes} disabled={busy}>
                  Ask for more times
                </Button>
                <Button color="error" variant="outlined" onClick={declineOfferedTimes} disabled={busy}>
                  Decline
                </Button>
              </Stack>
            </>
          )}
        </Paper>
      )}

      {/* Offered times shown read-only to whoever isn't acting right now */}
      {meeting.status === MEETING_STATUS.PENDING_MENTEE_SELECTION && iAmMentor && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Times you offered</Typography>
          <Stack spacing={1}>
            {meeting.timeSlots.map((slot) => (
              <Typography key={slot.id}>• {new Date(slot.startTime).toLocaleString()}</Typography>
            ))}
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
