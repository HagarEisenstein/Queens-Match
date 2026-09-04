const ABSENT_SELF = new Set(["self", "both"]);
const ABSENT_OTHER = new Set(["other", "both"]);

/**
 * Pure aggregation of mentee + mentor outcome responses for one meeting.
 *
 * @param {object} input
 * @param {object|null} input.menteeOutcome
 * @param {object|null} input.mentorOutcome
 * @param {boolean} [input.retryAfterNoshowUsed=false]
 */
function aggregateOutcome({
  menteeOutcome,
  mentorOutcome,
  retryAfterNoshowUsed = false,
}) {
  if (!menteeOutcome || !mentorOutcome) {
    return {
      status: "awaiting_responses",
      mentorGhosted: false,
    };
  }

  const mentorGhosted =
    ABSENT_OTHER.has(menteeOutcome.absentParty) ||
    ABSENT_SELF.has(mentorOutcome.absentParty);

  if (menteeOutcome.happened !== mentorOutcome.happened) {
    return {
      status: "admin_review",
      mentorGhosted,
    };
  }

  if (menteeOutcome.happened && mentorOutcome.happened) {
    return {
      status: "completed",
      mentorGhosted,
    };
  }

  const bothWantRetry =
    menteeOutcome.stillWantToMeet === true &&
    mentorOutcome.stillWantToMeet === true;

  if (bothWantRetry && !retryAfterNoshowUsed) {
    return {
      status: "retry_pending",
      mentorGhosted,
    };
  }

  return {
    status: "not_completed",
    mentorGhosted,
  };
}

module.exports = { aggregateOutcome };
