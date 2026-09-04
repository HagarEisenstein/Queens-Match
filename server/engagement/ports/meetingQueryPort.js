/**
 * Port for reading meeting data owned by the scheduling module (Dev 2).
 * Engagement depends on this interface only — never on a Meeting Prisma model.
 */
function createEmptyMeetingQueryPort() {
  return {
    async findById(_meetingId) {
      return null;
    },
    async findScheduledMeetingsBetween(_range) {
      return [];
    },
    async findMeetingsAwaitingOutcome(_query) {
      return [];
    },
  };
}

module.exports = { createEmptyMeetingQueryPort };
