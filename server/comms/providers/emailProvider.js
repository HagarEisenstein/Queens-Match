const { buildEmailContent } = require("../emailContent");

function createEmailProvider({ emailTransport, fromAddress, clientUrl = null, env = process.env }) {
  if (!emailTransport || typeof emailTransport.sendMail !== "function") {
    throw new Error("Email transport is required");
  }

  // An explicit clientUrl wins so action links point at the deployed frontend
  // even when the process environment is missing CLIENT_URL.
  const linkEnv = clientUrl ? { ...env, CLIENT_URL: clientUrl } : env;

  return {
    channel: "email",
    async send({ recipient, type, title, message, actionUrl }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const content = buildEmailContent({ title, message, type, actionUrl, env: linkEnv });

      try {
        const deliveryResult = await emailTransport.sendMail({
          from: fromAddress,
          to: recipient.email,
          subject: title,
          text: content.text,
          html: content.html,
        });

        return { providerMessageId: deliveryResult.messageId || null };
      } catch (error) {
        const code = error.code || error.responseCode || "SMTP_ERROR";
        const detail = error.response || error.message || "unknown SMTP failure";
        throw new Error(`Email send failed (${code}): ${detail}`);
      }
    },
  };
}

module.exports = { createEmailProvider };
