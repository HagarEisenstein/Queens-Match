const nodeCron = require("node-cron");

function startNotificationJobs({
  scheduler = nodeCron,
  meetingReminderJob,
  postMeetingCheckJob,
  feedbackReminderJob,
  cronExpression = "0 * * * *",
  now = () => new Date(),
}) {
  let isRunning = false;

  return scheduler.schedule(cronExpression, async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const scanTime = now();
      await meetingReminderJob.run(scanTime);
      await postMeetingCheckJob.run(scanTime);
      await feedbackReminderJob.run(scanTime);
    } finally {
      isRunning = false;
    }
  });
}

module.exports = { startNotificationJobs };
