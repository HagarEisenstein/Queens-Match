function createEmailFallbackJob({ deliveryRepository, emailProvider }) {
  async function run(now = new Date()) {
    const deliveries = await deliveryRepository.findPendingEmailDeliveries(now);
    for (const delivery of deliveries) {
      const notification = delivery.notification;
      if (notification.readAt || notification.actionCompletedAt) {
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
