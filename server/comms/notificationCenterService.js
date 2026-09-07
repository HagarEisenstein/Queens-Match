const { NOTIFICATION_TYPES } = require("./notificationTypes");

function defaultActionUrl(type, meetingId) {
  if (!meetingId) return null;
  switch (type) {
    case NOTIFICATION_TYPES.ARRIVAL_CHECK:
      return `/meetings/${meetingId}/arrival`;
    case NOTIFICATION_TYPES.POST_MEETING_CHECK:
      return `/meetings/${meetingId}/outcome`;
    case NOTIFICATION_TYPES.FEEDBACK_REQUEST:
    case NOTIFICATION_TYPES.FEEDBACK_REMINDER:
      return `/meetings/${meetingId}/feedback`;
    default:
      return `/meetings/${meetingId}`;
  }
}

function createNotificationCenterService({
  notificationRepository,
  deliveryRepository,
  realtimeHub,
  emailDelayMilliseconds = 60 * 60 * 1000,
  now = () => new Date(),
}) {
  const defaultEmailTypes = new Set([
    "request_received", "times_offered", "meeting_rejected", "meeting_matched",
    "meeting_reminder", "post_meeting_check", "feedback_request", "feedback_reminder",
  ]);
  async function send(input) {
    const existing = await notificationRepository.findByDeduplicationKey(input.deduplicationKey);
    if (existing) return existing;

    const createdAt = now();
    const notificationData = {
      recipientId: input.recipientId,
      meetingId: input.meetingId || null,
      type: input.type,
      status: input.status || null,
      title: input.title,
      message: input.message,
      actionUrl:
        input.actionUrl ||
        defaultActionUrl(input.type, input.meetingId) ||
        null,
      metadata: input.metadata || null,
      popupEligible: input.popupEligible !== false,
      deduplicationKey: input.deduplicationKey,
    };
    const deliveries = [{ channel: "IN_APP", status: "SENT", sentAt: createdAt }];

    if (input.emailEligible ?? defaultEmailTypes.has(input.type)) {
      const deliveryDelay = input.emailDelayMilliseconds ?? emailDelayMilliseconds;
      deliveries.push({ channel: "EMAIL", status: "PENDING", nextAttemptAt: new Date(createdAt.getTime() + deliveryDelay) });
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

  return { send, defaultActionUrl };
}

module.exports = { createNotificationCenterService, defaultActionUrl };
