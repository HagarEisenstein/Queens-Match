const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_MS = 60 * 60 * 1000;
const DEFAULT_STALE_PROCESSING_MS = 15 * 60 * 1000;

function createEmailWorker({
  deliveryRepository,
  emailProvider,
  logger = console,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseMilliseconds = DEFAULT_RETRY_BASE_MS,
  staleProcessingMilliseconds = DEFAULT_STALE_PROCESSING_MS,
  concurrency = 5,
  minimumIntervalMilliseconds = 0,
  now = () => new Date(),
}) {
  let isRunning = false;
  let lastDispatchAt = 0;

  async function waitForRateLimit() {
    const waitMilliseconds = Math.max(0, minimumIntervalMilliseconds - (Date.now() - lastDispatchAt));
    if (waitMilliseconds) await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
    lastDispatchAt = Date.now();
  }

  async function processDelivery(delivery, runTime) {
    const notification = delivery.notification;
    if (notification.readAt || notification.actionCompletedAt) {
      await deliveryRepository.markSkipped(delivery.id);
      return;
    }

    try {
      await waitForRateLimit();
      const result = await emailProvider.send({ ...notification, recipient: notification.recipient });
      await deliveryRepository.markSent(delivery.id, {
        sentAt: runTime,
        providerMessageId: result.providerMessageId || null,
      });
    } catch (error) {
      const attemptCount = Number(delivery.attemptCount || 1);
      const terminal = attemptCount >= maxAttempts;
      const retryAt = terminal
        ? null
        : new Date(runTime.getTime() + retryBaseMilliseconds * (2 ** Math.max(0, attemptCount - 1)));
      logger.error?.("Notification delivery failed", {
        deliveryId: delivery.id,
        notificationId: notification.id,
        attemptCount,
        terminal,
        error: error.message,
      });
      await deliveryRepository.markFailed(delivery.id, error.message, retryAt, { terminal });
    }
  }

  async function run(runTime = now()) {
    if (isRunning) return { skipped: true, processed: 0 };
    isRunning = true;
    try {
      const deliveries = deliveryRepository.claimPendingEmailDeliveries
        ? await deliveryRepository.claimPendingEmailDeliveries(runTime, {
          limit: Math.max(concurrency, 1) * 20,
          staleAfter: staleProcessingMilliseconds,
        })
        : await deliveryRepository.findPendingEmailDeliveries(runTime);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), deliveries.length) }, async () => {
        while (cursor < deliveries.length) {
          const delivery = deliveries[cursor];
          cursor += 1;
          await processDelivery(delivery, runTime);
        }
      });
      await Promise.all(workers);
      return { skipped: false, processed: deliveries.length };
    } finally {
      isRunning = false;
    }
  }

  return { run };
}

module.exports = { createEmailWorker };
