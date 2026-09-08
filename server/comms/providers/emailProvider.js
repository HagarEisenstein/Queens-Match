function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createAbsoluteActionUrl(clientUrl, actionUrl) {
  if (!actionUrl) return null;
  if (!clientUrl) {
    throw new Error("CLIENT_URL is required for email action links");
  }
  return `${clientUrl.replace(/\/+$/, "")}/${actionUrl.replace(/^\/+/, "")}`;
}

function createEmailProvider({ emailTransport, fromAddress, clientUrl = process.env.CLIENT_URL }) {
  if (!emailTransport || typeof emailTransport.sendMail !== "function") {
    throw new Error("Email transport is required");
  }

  return {
    channel: "email",
    async send({ recipient, title, message, actionUrl }) {
      if (!recipient.email) {
        throw new Error(`Email address is required for recipient ${recipient.id}`);
      }

      const absoluteActionUrl = createAbsoluteActionUrl(clientUrl, actionUrl);
      const email = {
        from: fromAddress,
        to: recipient.email,
        subject: title,
        text: absoluteActionUrl ? `${message}\n\n${absoluteActionUrl}` : message,
      };
      if (absoluteActionUrl) {
        email.html = `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(absoluteActionUrl)}" style="display:inline-block;padding:10px 16px;background:#6b3fa0;color:#ffffff;text-decoration:none;border-radius:4px;">Open in QueenB</a></p>`;
      }

      const deliveryResult = await emailTransport.sendMail(email);

      return { providerMessageId: deliveryResult.messageId || null };
    },
  };
}

module.exports = { createEmailProvider };
