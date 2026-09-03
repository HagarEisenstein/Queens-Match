const LIFECYCLE_EVENTS = Object.freeze({
  ARRIVAL_RECORDED: "ArrivalRecorded",
  OUTCOME_AGGREGATED: "OutcomeAggregated",
  MEETING_COMPLETED: "MeetingCompleted",
  RETRY_PENDING: "RetryPending",
  MEETING_NOT_COMPLETED: "MeetingNotCompleted",
});

function createRecordingMeetingLifecyclePort() {
  const events = [];
  return {
    events,
    async emit(eventName, payload = {}) {
      events.push({ eventName, payload, at: new Date() });
    },
  };
}

function createNoopMeetingLifecyclePort() {
  return {
    async emit() {},
  };
}

module.exports = {
  LIFECYCLE_EVENTS,
  createRecordingMeetingLifecyclePort,
  createNoopMeetingLifecyclePort,
};
