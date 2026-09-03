function createNotificationCenterService({
  notificationRepository,
  deliveryRepository,
  realtimeHub,
  emailDelayMilliseconds = 60 * 60 * 1000,
  now = () => new Date(),
}) {
  const defaultEmailTypes = new Set([
    "request_received", "times_offered", "meeting_rejected", "meeting_matched",
    "meeting_reminder", "post_meeting_check", "feedback_reminder",
  ]);
  async function send(input) {
    const existing = await notificationRepository.findByDeduplicationKey(input.deduplicationKey);
    if (existing) return existing;

    const createdAt = now();
    const notificationData = {
      recipientId: input.recipientId,
      meetingId: input.meetingId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl || (input.meetingId ? `/meetings/${input.meetingId}` : null),
      popupEligible: input.popupEligible !== false,
      deduplicationKey: input.deduplicationKey,
    };
    const deliveries = [{ channel: "IN_APP", status: "SENT", sentAt: createdAt }];

    if (input.emailEligible ?? defaultEmailTypes.has(input.type)) {
      deliveries.push({ channel: "EMAIL", status: "PENDING", nextAttemptAt: new Date(createdAt.getTime() + emailDelayMilliseconds) });
    }

    let notification;
    if (notificationRepository.createWithDeliveries) {
      notification = await notificationRepository.createWithDeliveries(notificationData, deliveries);
    } else {
      notification = await notificationRepository.create(notificationData);
      for (const delivery of deliveries) {
        await deliveryRepository.create({ notificationId: notification.id, ...delivery });
      }
    }

    realtimeHub.publish(notification.recipientId, notification);
    return notification;
  }

  return { send };
}

module.exports = { createNotificationCenterService };
