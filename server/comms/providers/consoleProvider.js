function createConsoleProvider({ logger }) {
  return {
    channel: "console",
    async send({ recipient, type, title, message }) {
      logger.info("Notification sent", {
        recipientId: recipient.id,
        type,
        title,
        notificationMessage: message,
      });
      return { providerMessageId: null };
    },
  };
}

module.exports = { createConsoleProvider };
