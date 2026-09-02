function createEmailProvider({ emailTransport, fromAddress }) {
  if (!emailTransport || typeof emailTransport.sendMail !== "function") {
    throw new Error("Email transport is required");
  }

  return {
    channel: "email",
    async send({ recipient, title, message }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const deliveryResult = await emailTransport.sendMail({
        from: fromAddress,
        to: recipient.email,
        subject: title,
        text: message,
      });

      return { providerMessageId: deliveryResult.messageId || null };
    },
  };
}

module.exports = { createEmailProvider };
