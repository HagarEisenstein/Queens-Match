const test = require("node:test");
const assert = require("node:assert/strict");
const { createConsoleProvider } = require("../providers/consoleProvider");
const { createBrevoProvider } = require("../providers/brevoProvider");
const { createEmailProvider } = require("../providers/emailProvider");
const { createNotificationProvider } = require("../providers/providerFactory");
const { createWhatsAppProvider } = require("../providers/whatsappProvider");
const { createWhatsAppOrEmailProvider } = require("../providers/whatsappOrEmailProvider");
const { createTwilioEmailProvider } = require("../providers/twilioEmailProvider");
const { buildAbsoluteAppUrl, resolveAppBaseUrl } = require("../emailContent");
const nodemailer = require("nodemailer");

const originalCreateTransport = nodemailer.createTransport;

process.on("exit", () => {
  nodemailer.createTransport = originalCreateTransport;
});

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
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    actionUrl: "/meetings/meeting-1",
  });

  assert.equal(provider.channel, "email");
  assert.deepEqual(deliveries[0], {
    from: "notifications@queenb.example",
    to: "user@example.com",
    subject: "Meeting reminder",
    text: `Your meeting starts soon\n\nOpen your meeting: http://localhost:3000/meetings/meeting-1\nIf the button does not open, copy and paste this URL into your browser: http://localhost:3000/meetings/meeting-1`,
    html: '<p>Your meeting starts soon</p><p><a href="http://localhost:3000/meetings/meeting-1">Open your meeting</a></p><p>Direct link: <a href="http://localhost:3000/meetings/meeting-1">http://localhost:3000/meetings/meeting-1</a></p>',
  });
  assert.equal(result.providerMessageId, "email-1");
});

test("Gmail email provider defaults to smtp.gmail.com:465 over IPv4", async () => {
  const transports = [];
  nodemailer.createTransport = (config) => {
    transports.push(config);
    return {
      async sendMail(delivery) {
        return { messageId: `${delivery.to}:sent` };
      },
    };
  };

  const provider = createBrevoProvider({
    SMTP_USER: "queenb@gmail.com",
    SMTP_PASSWORD: "app-password",
    EMAIL_FROM: "queenb@gmail.com",
    CLIENT_URL: "https://queenb-task-management-application.onrender.com",
  });

  const result = await provider.send({
    recipient: { id: "user-1", email: "user@example.com" },
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    actionUrl: "/meetings/meeting-1",
  });

  assert.equal(provider.channel, "email");
  assert.deepEqual(transports[0], {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4,
    auth: {
      user: "queenb@gmail.com",
      pass: "app-password",
    },
  });
  assert.equal(result.providerMessageId, "user@example.com:sent");
  nodemailer.createTransport = originalCreateTransport;
});

test("Gmail provider builds action links from CLIENT_URL even when it is not in process.env", async () => {
  const deliveries = [];
  nodemailer.createTransport = () => ({
    async sendMail(delivery) {
      deliveries.push(delivery);
      return { messageId: "gmail-1" };
    },
  });

  const provider = createBrevoProvider({
    SMTP_USER: "queenb@gmail.com",
    SMTP_PASSWORD: "app-password",
    EMAIL_FROM: "queenb@gmail.com",
    CLIENT_URL: "https://queenb-task-management-application.onrender.com/",
  });

  await provider.send({
    recipient: { id: "mentor-1", email: "mentor@example.com" },
    type: "feedback_request",
    title: "Please leave meeting feedback",
    message: "Share a short rating.",
    actionUrl: "/meetings/meeting-1/feedback",
  });

  const expectedLink =
    "https://queenb-task-management-application.onrender.com/meetings/meeting-1/feedback";
  assert.ok(deliveries[0].text.includes(expectedLink));
  assert.ok(deliveries[0].html.includes(`href="${expectedLink}"`));
  nodemailer.createTransport = originalCreateTransport;
});

test("blank optional SMTP overrides never displace the Gmail defaults", async () => {
  const transports = [];
  nodemailer.createTransport = (config) => {
    transports.push(config);
    return { async sendMail() { return { messageId: "gmail-2" }; } };
  };

  // Render exposes declared-but-unset variables as empty strings.
  createBrevoProvider({
    SMTP_USER: "queenb@gmail.com",
    SMTP_PASSWORD: "app-password",
    EMAIL_FROM: "queenb@gmail.com",
    EMAIL_HOST: "",
    EMAIL_PORT: "",
    EMAIL_SECURE: "",
    EMAIL_USER: "",
    EMAIL_PASSWORD: "",
  });

  assert.deepEqual(transports[0], {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    family: 4,
    auth: { user: "queenb@gmail.com", pass: "app-password" },
  });
  nodemailer.createTransport = originalCreateTransport;
});

test("email provider accepts optional EMAIL_HOST override without requiring it", async () => {
  const transports = [];
  nodemailer.createTransport = (config) => {
    transports.push(config);
    return {
      async sendMail(delivery) {
        return { messageId: `${delivery.to}:sent` };
      },
    };
  };

  const provider = createBrevoProvider({
    EMAIL_HOST: "smtp-relay.example.com",
    EMAIL_PORT: "587",
    EMAIL_USER: "mailer",
    EMAIL_PASSWORD: "secret",
    EMAIL_FROM: "notifications@queenb.example",
  });

  await provider.send({
    recipient: { id: "user-1", email: "user@example.com" },
    type: "meeting_reminder",
    title: "Meeting reminder",
    message: "Your meeting starts soon",
    actionUrl: "/meetings/meeting-1",
  });

  assert.equal(provider.channel, "email");
  assert.deepEqual(transports[0], {
    host: "smtp-relay.example.com",
    port: 587,
    secure: false,
    family: 4,
    auth: {
      user: "mailer",
      pass: "secret",
    },
  });
  nodemailer.createTransport = originalCreateTransport;
});

test("email provider requires only SMTP credentials for Gmail mode", () => {
  assert.throws(
    () => createBrevoProvider({ EMAIL_FROM: "notifications@queenb.example" }),
    /SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are required for email/,
  );
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
    type: "welcome",
    title: "Welcome to Queen's Match!",
    message: "Welcome!",
    actionUrl: "/profile?welcome=1",
  });

  assert.equal(result.providerMessageId, "comms_operation_123");
  assert.equal(requests[0].url, "https://comms.twilio.com/v1/Emails");
  assert.equal(requests[0].options.body.includes("user@example.com"), true);
  assert.equal(requests[0].options.body.includes("http://localhost:3000/profile?welcome=1"), true);
  assert.match(requests[0].options.headers.Authorization, /^Basic /);
});

test("email content resolves the configured frontend base URL", () => {
  assert.equal(resolveAppBaseUrl({ CLIENT_URL: "https://queenb.example/" }), "https://queenb.example");
  assert.equal(resolveAppBaseUrl({ APP_URL: "https://app.example.com/" }), "https://app.example.com");
  assert.equal(resolveAppBaseUrl({ FRONTEND_URL: "https://frontend.example.com" }), "https://frontend.example.com");
  assert.equal(resolveAppBaseUrl({ NEXT_PUBLIC_APP_URL: "https://next.example.com/" }), "https://next.example.com");
  assert.equal(
    buildAbsoluteAppUrl("/meetings/m1", { CLIENT_URL: "https://queenb-task-management-application.onrender.com" }),
    "https://queenb-task-management-application.onrender.com/meetings/m1",
  );
});
