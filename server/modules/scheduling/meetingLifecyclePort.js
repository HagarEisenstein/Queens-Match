const { LIFECYCLE_EVENTS } = require("../../engagement/ports/meetingLifecyclePort");
const logger = require("../../commons/logger");

/**
 * The real implementation of engagement's `meetingLifecyclePort`. Engagement
 * emits `RetryPending` once both sides say "still want to meet" after a
 * no-show and its own one-retry rule (`retryAfterNoshowUsed`) hasn't already
 * been spent [R7] — this is the other end of that seam: it reopens the
 * meeting for a fresh round of offer-times.
 */
function createSchedulingMeetingLifecyclePort({ reopenAfterNoShow }) {
  return {
    async emit(eventName, payload = {}) {
      if (eventName !== LIFECYCLE_EVENTS.RETRY_PENDING) return;

      try {
        await reopenAfterNoShow({ meetingId: payload.meetingId });
      } catch (error) {
        // The outcome that triggered this was already recorded; don't fail
        // that request just because the reopen failed. Log and move on.
        logger.error("Failed to reopen meeting after a no-show retry", {
          meetingId: payload.meetingId,
          error: error.message,
        });
      }
    },
  };
}

module.exports = { createSchedulingMeetingLifecyclePort };
