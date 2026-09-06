function createWhatsAppProvider(env = process.env, { fetchImpl = global.fetch, logger = console } = {}) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from } = env;
  const parsedTimeoutMilliseconds = Number.parseInt(env.NOTIFICATION_PROVIDER_TIMEOUT_MS || "10000", 10);
  const timeoutMilliseconds = Number.isFinite(parsedTimeoutMilliseconds) && parsedTimeoutMilliseconds > 0
    ? parsedTimeoutMilliseconds
    : 10000;
  if (!sid || !token || !from) throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM are required for WhatsApp");
  return {
    channel: "whatsapp",
    async send({ recipient, message }) {
      if (!recipient.phone) {
        logger.warn?.("WhatsApp notification skipped: recipient has no phone number", { recipientId: recipient.id });
        return { providerMessageId: null, skipped: true };
      }
      const body = new URLSearchParams({
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        To: recipient.phone.startsWith("whatsapp:") ? recipient.phone : `whatsapp:${recipient.phone}`,
        Body: message,
      });
      const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMilliseconds),
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error(`WhatsApp provider returned ${response.status}`);
      const data = await response.json();
      return { providerMessageId: data.sid || null };
    },
  };
}

module.exports = { createWhatsAppProvider };
