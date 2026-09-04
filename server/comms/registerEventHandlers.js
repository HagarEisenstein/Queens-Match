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
    TimesOffered: ({ meetingId, menteeId, offeredAt }) => notificationService.send(createNotification({
      recipientId: menteeId,
      meetingId,
      type: NOTIFICATION_TYPES.TIMES_OFFERED,
      title: "Meeting times available",
      message: "Your mentor offered meeting times for you to choose from.",
      // A mentor can offer more than once per meeting (Epic 4 retries), so
      // each round gets its own notification instead of being deduped away.
      uniqueValue: offeredAt || "initial",
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
    MoreTimesRequested: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MORE_TIMES_REQUESTED,
      title: "More times requested",
      message: "The mentee couldn't make any of your offered times — please offer a few more.",
    })),
    MeetingDeclinedByMentee: ({ meetingId, mentorId }) => notificationService.send(createNotification({
      recipientId: mentorId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_DECLINED_BY_MENTEE,
      title: "Meeting declined",
      message: "The mentee couldn't make any of the offered times and declined this meeting.",
    })),
    MeetingRescheduleRequested: ({ meetingId, recipientId }) => notificationService.send(createNotification({
      recipientId,
      meetingId,
      type: NOTIFICATION_TYPES.MEETING_RESCHEDULE_REQUESTED,
      title: "Meeting needs rescheduling",
      message: "The other side can't make it. Waiting on the mentor to offer new times.",
    })),
    MeetingCancelled: ({ meetingId, mentorId, menteeId }) => Promise.all(
      [mentorId, menteeId].map((recipientId) => notificationService.send(createNotification({
        recipientId,
        meetingId,
        type: NOTIFICATION_TYPES.MEETING_CANCELLED,
        title: "Meeting cancelled",
        message: "This meeting has been cancelled after a second scheduling conflict.",
      })))
    ),
    MeetingReopenedAfterNoShow: ({ meetingId, mentorId, menteeId }) => Promise.all(
      [mentorId, menteeId].map((recipientId) => notificationService.send(createNotification({
        recipientId,
        meetingId,
        type: NOTIFICATION_TYPES.MEETING_REOPENED_AFTER_NO_SHOW,
        title: "Meeting reopened",
        message: "You both still want to meet. Waiting on the mentor to offer new times.",
      })))
    ),
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
