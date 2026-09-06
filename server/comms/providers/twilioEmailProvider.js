function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createTwilioEmailProvider(env = process.env, { fetchImpl = global.fetch } = {}) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = env;
  const fromAddress = env.TWILIO_EMAIL_FROM || (sid ? `${sid}@twilio.email` : "");
  const fromName = env.TWILIO_EMAIL_FROM_NAME || "Queens Match";
  const parsedTimeoutMilliseconds = Number.parseInt(env.NOTIFICATION_PROVIDER_TIMEOUT_MS || "10000", 10);
  const timeoutMilliseconds = Number.isFinite(parsedTimeoutMilliseconds) && parsedTimeoutMilliseconds > 0
    ? parsedTimeoutMilliseconds
    : 10000;

  if (!sid || !token || !fromAddress) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_EMAIL_FROM are required for Twilio Email");
  }

  return {
    channel: "twilio-email",
    async send({ recipient, title, message }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const response = await fetchImpl("https://comms.twilio.com/v1/Emails", {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMilliseconds),
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { address: fromAddress, name: fromName },
          to: [{ address: recipient.email }],
          content: {
            subject: title,
            text: message,
            html: `<p>${escapeHtml(message).replaceAll("\\n", "<br>")}</p>`,
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
