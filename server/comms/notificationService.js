function createNotificationService({
  provider,
  notificationLogRepository,
  recipientRepository,
  now = () => new Date(),
}) {
  async function send(notification) {
    const existingNotification = await notificationLogRepository.findSentByDeduplicationKey(
      notification.deduplicationKey,
    );

    if (existingNotification) {
      return existingNotification;
    }

    const attemptedAt = now();

    try {
      const recipient = await recipientRepository.findById(notification.recipientId);

      if (!recipient) {
        throw new Error(`Notification recipient not found: ${notification.recipientId}`);
      }

      const deliveryResult = await provider.send({ ...notification, recipient });

      return notificationLogRepository.create({
        recipientId: notification.recipientId,
        meetingId: notification.meetingId || null,
        type: notification.type,
        channel: provider.channel,
        status: "sent",
        sentAt: attemptedAt,
        providerMessageId: deliveryResult.providerMessageId || null,
        errorMessage: null,
        deduplicationKey: notification.deduplicationKey,
      });
    } catch (error) {
      await notificationLogRepository.create({
        recipientId: notification.recipientId,
        meetingId: notification.meetingId || null,
        type: notification.type,
        channel: provider.channel,
        status: "failed",
        sentAt: attemptedAt,
        providerMessageId: null,
        errorMessage: error.message,
        deduplicationKey: notification.deduplicationKey,
      });
      throw error;
    }
  }

  return { send };
}

module.exports = { createNotificationService };
