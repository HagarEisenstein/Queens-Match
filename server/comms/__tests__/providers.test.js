const test = require("node:test");
const assert = require("node:assert/strict");
const { createConsoleProvider } = require("../providers/consoleProvider");
const { createEmailProvider } = require("../providers/emailProvider");
const { createNotificationProvider } = require("../providers/providerFactory");
const { createWhatsAppProvider } = require("../providers/whatsappProvider");
const { createWhatsAppOrEmailProvider } = require("../providers/whatsappOrEmailProvider");
const { createTwilioEmailProvider } = require("../providers/twilioEmailProvider");

test("console provider writes a structured notification", async () => {
  const entries = [];
  const provider = createConsoleProvider({
    logger: {
      info(message, metadata) {
        entries.push({ message, metadata });
      },
    },
  });

  await provider.send({
    recipient: { id: "user-1" },
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
  });

  assert.equal(provider.channel, "console");
  assert.deepEqual(entries[0], {
    message: "Notification sent",
    metadata: {
      recipientId: "user-1",
      type: "meeting_reminder",
      title: "Meeting reminder",
      notificationMessage: "Your meeting starts soon",
    },
  });
});

test("email provider delegates delivery to the supplied transport", async () => {
  const deliveries = [];
  const provider = createEmailProvider({
    fromAddress: "notifications@queenb.example",
    emailTransport: {
      async sendMail(delivery) {
        deliveries.push(delivery);
        return { messageId: "email-1" };
      },
    },
  });

  const result = await provider.send({
    recipient: { id: "user-1", email: "user@example.com" },
    title: "Meeting reminder",
    message: "Your meeting starts soon",
  });

  assert.equal(provider.channel, "email");
  assert.deepEqual(deliveries[0], {
    from: "notifications@queenb.example",
    to: "user@example.com",
    subject: "Meeting reminder",
    text: "Your meeting starts soon",
  });
  assert.equal(result.providerMessageId, "email-1");
});

test("provider factory selects providers without changing callers", () => {
  const logger = { info() {} };
  const emailTransport = { sendMail() {} };

  assert.equal(createNotificationProvider("console", { logger }).channel, "console");
  assert.equal(
    createNotificationProvider("email", {
      emailTransport,
      fromAddress: "notifications@queenb.example",
    }).channel,
    "email",
  );
  assert.throws(() => createNotificationProvider("unknown", {}), /Unsupported notification provider/);
});

test("WhatsApp provider sends an authenticated Twilio message", async () => {
  const requests = [];
  const provider = createWhatsAppProvider(
    {
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_WHATSAPP_FROM: "whatsapp:+14155552671",
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, async json() { return { sid: "SM123" }; } };
      },
    },
  );

  const result = await provider.send({
    recipient: { id: "user-1", phone: "+14155552672" },
    message: "Meeting reminder",
  });

  assert.equal(result.providerMessageId, "SM123");
  assert.equal(requests[0].url, "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
  assert.match(requests[0].options.headers.Authorization, /^Basic /);
  assert.equal(requests[0].options.body.get("From"), "whatsapp:+14155552671");
  assert.equal(requests[0].options.body.get("To"), "whatsapp:+14155552672");
});

test("WhatsApp-or-email provider uses email when phone is optional and absent", async () => {
  const sent = [];
  const provider = createWhatsAppOrEmailProvider(
    {},
    {
      whatsappProvider: { send: async () => { throw new Error("WhatsApp should not be used"); } },
      emailProvider: {
        async send(input) {
          sent.push(input);
          return { providerMessageId: "email-123" };
        },
      },
    },
  );

  const result = await provider.send({
    recipient: { id: "user-1", email: "user@example.com" },
    title: "Meeting reminder",
    message: "Your meeting starts soon",
  });

  assert.equal(provider.channel, "whatsapp-or-email");
  assert.equal(result.providerMessageId, "email-123");
  assert.equal(sent[0].recipient.email, "user@example.com");
});

test("Twilio Email provider sends the welcome email through the Comms API", async () => {
  const requests = [];
  const provider = createTwilioEmailProvider(
    {
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "secret",
      TWILIO_EMAIL_FROM: "AC123@twilio.email",
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 202, async json() { return { operationId: "comms_operation_123" }; } };
      },
    },
  );

  const result = await provider.send({
    recipient: { id: "user-1", email: "user@example.com" },
    title: "Welcome to Queens Match!",
    message: "Welcome!",
  });

  assert.equal(result.providerMessageId, "comms_operation_123");
  assert.equal(requests[0].url, "https://comms.twilio.com/v1/Emails");
  assert.equal(requests[0].options.body.includes("user@example.com"), true);
  assert.match(requests[0].options.headers.Authorization, /^Basic /);
});
