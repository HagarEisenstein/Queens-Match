const { AppError } = require("../middleware/errors");

function createBlocklistService({ blocklistRepository }) {
  async function isBlocked(menteeId, mentorId) {
    const block = await blocklistRepository.findActive(menteeId, mentorId);
    return Boolean(block);
  }

  async function assertCanBook(menteeId, mentorId) {
    if (await isBlocked(menteeId, mentorId)) {
      throw new AppError(
        403,
        "MENTOR_BLOCKED",
        "This mentee cannot book this mentor."
      );
    }
  }

  async function blockMentorForMentee({
    menteeId,
    mentorId,
    meetingId,
    reason = "mentor_ghosted",
  }) {
    return blocklistRepository.createBlock({
      menteeId,
      mentorId,
      meetingId,
      reason,
    });
  }

  async function listActive(filters = {}) {
    return blocklistRepository.listActive(filters);
  }

  async function clearBlock(blockId) {
    const cleared = await blocklistRepository.clearBlock(blockId);
    if (!cleared) {
      throw new AppError(404, "NOT_FOUND", "Block not found.");
    }
    return cleared;
  }

  return {
    isBlocked,
    assertCanBook,
    blockMentorForMentee,
    listActive,
    clearBlock,
  };
}

module.exports = { createBlocklistService };
