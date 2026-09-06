const { NOTIFICATION_TYPES } = require("./notificationTypes");

function createNotification({
  recipientId,
  meetingId,
  type,
  title,
  message,
  uniqueValue = "initial",
  actionUrl,
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
    })),
    TimesOffered: ({ meetingId, menteeId }) => notificationService.send(createNotification({
      recipientId: menteeId,
      meetingId,
      type: NOTIFICATION_TYPES.TIMES_OFFERED,
      title: "Meeting times available",
      message: "Your mentor offered meeting times for you to choose from.",
    })),
    MeetingRejected: ({ meetingId, menteeId }) => notificationService.send(createNotification({
      recipientId: menteeId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_REJECTED,
      title: "Meeting request update",
      message: "The mentor could not accept this meeting request.",
    })),
    MeetingMatched: ({ meetingId, mentorId, scheduledTime }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_MATCHED,
      title: "Meeting scheduled",
      message: `Your meeting was scheduled for ${new Date(scheduledTime).toISOString()}.`,
      uniqueValue: new Date(scheduledTime).toISOString(),
    })),
    MeetingCompleted: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MENTOR_THANK_YOU,
      title: "Thank you",
      message: "Thank you for mentoring with QueenB.",
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
