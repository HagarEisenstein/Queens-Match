const { buildEmailContent } = require("../emailContent");

function createTwilioEmailProvider(env = process.env, { fetchImpl = global.fetch } = {}) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  const fromAddress = env.TWILIO_EMAIL_FROM || (sid ? `${sid}@twilio.email` : "");
  const fromName = env.TWILIO_EMAIL_FROM_NAME || "Queen's Match";

  if (!sid || !token || !fromAddress) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_EMAIL_FROM are required for Twilio Email");
  }

  return {
    channel: "twilio-email",
    async send({ recipient, type, title, message, actionUrl }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const content = buildEmailContent({ title, message, type, actionUrl, env });

      const response = await fetchImpl("https://comms.twilio.com/v1/Emails", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { address: fromAddress, name: fromName },
          to: [{ address: recipient.email }],
          content: {
            subject: title,
            text: content.text,
            html: content.html,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`Twilio Email provider returned ${response.status}${errorBody ? `: ${errorBody}` : ""}`);
      }

      const data = await response.json().catch(() => ({}));
      return { providerMessageId: data.operationId || null };
    },
  };
}

module.exports = { createTwilioEmailProvider };
