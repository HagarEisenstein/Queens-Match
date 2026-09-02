const nodeCron = require("node-cron");

function startNotificationJobs({
  scheduler = nodeCron,
  meetingReminderJob,
  postMeetingCheckJob,
  feedbackReminderJob,
  cronExpression = "0 * * * *",
  now = () => new Date(),
}) {
  return scheduler.schedule(cronExpression, async () => {
    const scanTime = now();
    await meetingReminderJob.run(scanTime);
    await postMeetingCheckJob.run(scanTime);
    await feedbackReminderJob.run(scanTime);
  });
}

module.exports = { startNotificationJobs };
