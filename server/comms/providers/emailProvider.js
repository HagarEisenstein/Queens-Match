const { buildEmailContent } = require("../emailContent");

function createEmailProvider({ emailTransport, fromAddress }) {
  if (!emailTransport || typeof emailTransport.sendMail !== "function") {
    throw new Error("Email transport is required");
  }

  return {
    channel: "email",
    async send({ recipient, type, title, message, actionUrl }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const content = buildEmailContent({ title, message, type, actionUrl });

      const deliveryResult = await emailTransport.sendMail({
        from: fromAddress,
        to: recipient.email,
        subject: title,
        text: content.text,
        html: content.html,
      });

      return { providerMessageId: deliveryResult.messageId || null };
    },
  };
}

module.exports = { createEmailProvider };
