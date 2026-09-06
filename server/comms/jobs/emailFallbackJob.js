const { createEmailWorker } = require("./emailWorker");

// Kept as a compatibility name for callers and tests from the original polling job.
function createEmailFallbackJob(options) {
  return createEmailWorker({ concurrency: 1, ...options });
}

module.exports = { createEmailFallbackJob };
