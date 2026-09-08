const { IMPORTANT_NOTIFICATION_TYPES } = require("../notificationTypes");

function createEmailFallbackJob({ deliveryRepository, emailProvider }) {
  async function run(now = new Date()) {
    const deliveries = await deliveryRepository.findPendingEmailDeliveries(now);
    for (const delivery of deliveries) {
      const notification = delivery.notification;
      const alreadyHandled = notification.readAt || notification.actionCompletedAt;
      // Important prompts still go out after being seen in-app; only the
      // low-priority digest mail is dropped once the user has acted.
      if (alreadyHandled && !IMPORTANT_NOTIFICATION_TYPES.has(notification.type)) {
        await deliveryRepository.markSkipped(delivery.id);
        continue;
      }
      try {
        const result = await emailProvider.send({ ...notification, recipient: notification.recipient });
        await deliveryRepository.markSent(delivery.id, {
          sentAt: now,
          providerMessageId: result.providerMessageId || null,
        });
      } catch (error) {
        const retryAt = new Date(now.getTime() + 60 * 60 * 1000);
        await deliveryRepository.markFailed(delivery.id, error.message, retryAt);
      }
    }
  }
  return { run };
}

module.exports = { createEmailFallbackJob };
