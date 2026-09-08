const { NOTIFICATION_TYPES } = require("./notificationTypes");

function defaultActionUrl(type, meetingId) {
  switch (type) {
    case NOTIFICATION_TYPES.WELCOME:
      return "/profile";
    case NOTIFICATION_TYPES.REQUEST_RECEIVED:
      return meetingId ? `/meetings/${meetingId}?action=offer-times` : "/meetings";
    case NOTIFICATION_TYPES.TIMES_OFFERED:
      return meetingId ? `/meetings/${meetingId}` : "/meetings";
    case NOTIFICATION_TYPES.MORE_TIMES_REQUESTED:
      return meetingId ? `/meetings/${meetingId}?action=offer-times` : "/meetings";
    case NOTIFICATION_TYPES.MEETING_REJECTED:
      return meetingId ? `/meetings/${meetingId}` : "/meetings";
    case NOTIFICATION_TYPES.MEETING_DECLINED:
      return meetingId ? `/meetings/${meetingId}` : "/meetings";
    case NOTIFICATION_TYPES.MEETING_MATCHED:
    case NOTIFICATION_TYPES.MEETING_REMINDER:
    case NOTIFICATION_TYPES.MENTOR_THANK_YOU:
      return meetingId ? `/meetings/${meetingId}` : "/meetings";
    case NOTIFICATION_TYPES.ARRIVAL_CHECK:
      return meetingId ? `/meetings/${meetingId}/arrival` : "/meetings";
    case NOTIFICATION_TYPES.POST_MEETING_CHECK:
      return meetingId ? `/meetings/${meetingId}/outcome` : "/meetings";
    case NOTIFICATION_TYPES.FEEDBACK_REQUEST:
    case NOTIFICATION_TYPES.FEEDBACK_REMINDER:
      return meetingId ? `/meetings/${meetingId}/feedback` : "/meetings";
    default:
      return meetingId ? `/meetings/${meetingId}` : "/meetings";
  }
}

function createNotificationCenterService({
  notificationRepository,
  deliveryRepository,
  realtimeHub,
  recipientRepository = null,
  emailProvider = null,
  emailDelayMilliseconds = 60 * 60 * 1000,
  now = () => new Date(),
}) {
  const defaultEmailTypes = new Set([
    "request_received", "times_offered", "more_times_requested", "meeting_rejected",
    "meeting_declined", "meeting_matched", "meeting_reminder", "post_meeting_check",
    "feedback_request", "feedback_reminder",
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
      actionUrl:
        input.actionUrl ||
        defaultActionUrl(input.type, input.meetingId) ||
        null,
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

    const emailDelivery = deliveries.find((delivery) => delivery.channel === "EMAIL");
    if (
      emailDelivery &&
      input.emailEligible !== false &&
      emailProvider &&
      recipientRepository &&
      emailDelivery.nextAttemptAt.getTime() <= createdAt.getTime()
    ) {
      try {
        const recipient = await recipientRepository.findById(notification.recipientId);
        if (!recipient) {
          throw new Error(`Recipient ${notification.recipientId} not found`);
        }
        const result = await emailProvider.send({ ...notification, recipient });
        const pendingDelivery = await deliveryRepository.findPendingEmailDeliveryForNotification?.(notification.id);
        if (pendingDelivery) {
          await deliveryRepository.markSent(pendingDelivery.id, {
            sentAt: createdAt,
            providerMessageId: result.providerMessageId || null,
          });
        }
      } catch (error) {
        const pendingDelivery = await deliveryRepository.findPendingEmailDeliveryForNotification?.(notification.id);
        if (pendingDelivery) {
          const retryAt = new Date(createdAt.getTime() + 60 * 60 * 1000);
          await deliveryRepository.markFailed(
            pendingDelivery.id,
            error.message,
            retryAt
          );
        }
      }
    }

    realtimeHub.publish(notification.recipientId, notification);
    return notification;
  }

  return { send, defaultActionUrl };
}

module.exports = { createNotificationCenterService, defaultActionUrl };
