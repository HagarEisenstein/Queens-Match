const { createNotificationCenterService } = require("./notificationCenterService");
const { NOTIFICATION_TYPES } = require("./notificationTypes");
const { registerNotificationEventHandlers } = require("./registerEventHandlers");
const { createNotificationProvider } = require("./providers/providerFactory");
const { createMeetingReminderJob } = require("./jobs/meetingReminderJob");
const { createPostMeetingCheckJob } = require("./jobs/postMeetingCheckJob");
const { createFeedbackReminderJob } = require("./jobs/feedbackReminderJob");
const { startNotificationJobs } = require("./jobs/startJobs");
const { createEmailFallbackJob } = require("./jobs/emailFallbackJob");
const { createRealtimeHub } = require("./realtimeHub");
const { createNotificationsRouter } = require("./routes");
const { bootstrapNotifications } = require("./bootstrap");

module.exports = {
  createNotificationCenterService,
  NOTIFICATION_TYPES,
  registerNotificationEventHandlers,
  createNotificationProvider,
  createMeetingReminderJob,
  createPostMeetingCheckJob,
  createFeedbackReminderJob,
  startNotificationJobs,
  createEmailFallbackJob,
  createRealtimeHub,
  createNotificationsRouter,
  bootstrapNotifications,
};
