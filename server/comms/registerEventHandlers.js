const { NOTIFICATION_TYPES } = require("./notificationTypes");

function createNotification({
  recipientId,
  meetingId,
  type,
  title,
  message,
  uniqueValue = "initial",
  actionUrl,
  emailDelayMilliseconds,
}) {
  const notification = {
    recipientId,
    meetingId,
    type,
    title,
    message,
    deduplicationKey: `${type}:${meetingId}:${recipientId}:${uniqueValue}`,
  };
  if (actionUrl) {
    notification.actionUrl = actionUrl;
  }
  if (emailDelayMilliseconds != null) {
    notification.emailDelayMilliseconds = emailDelayMilliseconds;
  }
  return notification;
}

function registerNotificationEventHandlers({ eventBus, notificationService, logger = console }) {
  const handlers = {
    MeetingRequested: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
      title: "New meeting request",
      message: "A mentee requested a meeting with you.",
      actionUrl: `/meetings/${meetingId}?action=offer-times`,
      emailDelayMilliseconds: 0,
    })),
    TimesOffered: ({ meetingId, menteeId }) => notificationService.send(createNotification({
      recipientId: menteeId,
      meetingId,
      type: NOTIFICATION_TYPES.TIMES_OFFERED,
      title: "Meeting times available",
      message: "Your mentor offered meeting times for you to choose from.",
      actionUrl: `/meetings/${meetingId}`,
      emailDelayMilliseconds: 0,
    })),
    MoreTimesRequested: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MORE_TIMES_REQUESTED,
      title: "Additional times requested",
      message: "Your mentee asked for another round of availability for this meeting.",
      actionUrl: `/meetings/${meetingId}?action=offer-times`,
      emailDelayMilliseconds: 0,
    })),
    MeetingRejected: ({ meetingId, menteeId }) => notificationService.send(createNotification({
      recipientId: menteeId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_REJECTED,
      title: "Meeting request update",
      message: "The mentor could not accept this meeting request.",
      actionUrl: `/meetings/${meetingId}`,
      emailDelayMilliseconds: 0,
    })),
    MeetingDeclined: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_DECLINED,
      title: "Meeting request closed",
      message: "The mentee declined this meeting after reviewing the available times.",
      actionUrl: `/meetings/${meetingId}`,
      emailDelayMilliseconds: 0,
    })),
    MeetingMatched: ({ meetingId, mentorId, menteeId, scheduledTime }) => {
      const formattedTime = new Date(scheduledTime).toISOString();
      return Promise.all([mentorId, menteeId].map((recipientId) =>
        notificationService.send(createNotification({
          recipientId,
          meetingId,
          type: NOTIFICATION_TYPES.MEETING_MATCHED,
          title: "Meeting confirmed",
          message: `Your meeting is confirmed for ${formattedTime}.`,
          uniqueValue: formattedTime,
          actionUrl: `/meetings/${meetingId}`,
          emailDelayMilliseconds: 0,
        }))
      ));
    },
    MeetingCompleted: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MENTOR_THANK_YOU,
      title: "Thank you",
      message: "Thank you for mentoring with QueenB.",
      actionUrl: `/meetings/${meetingId}`,
    })),
  };

  const registeredHandlers = new Map();

  for (const [eventName, handler] of Object.entries(handlers)) {
    const registeredHandler = (event) => {
      Promise.resolve(handler(event)).catch((error) => {
        logger.error("Notification event failed", { eventName, error: error.message });
      });
    };
    registeredHandlers.set(eventName, registeredHandler);
    eventBus.on(eventName, registeredHandler);
  }

  return function unregisterNotificationEventHandlers() {
    for (const [eventName, registeredHandler] of registeredHandlers) {
      eventBus.off(eventName, registeredHandler);
    }
  };
}

module.exports = { registerNotificationEventHandlers, createNotification };
