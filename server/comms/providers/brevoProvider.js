const nodemailer = require("nodemailer");
const { createEmailProvider } = require("./emailProvider");

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

/**
 * Nodemailer SMTP provider used when NOTIFICATION_PROVIDER=email.
 * Defaults to Gmail over IPv4 (smtp.gmail.com:465) so Render does not need
 * EMAIL_HOST/EMAIL_PORT. Optional EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE still
 * override the defaults for non-Gmail SMTP.
 */
function createBrevoProvider(env = process.env) {
  const user = env.EMAIL_USER || env.SMTP_USER;
  const pass = env.EMAIL_PASSWORD || env.SMTP_PASSWORD;
  const fromAddress = env.EMAIL_FROM;

  if (!user || !pass || !fromAddress) {
    throw new Error("SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are required for email");
  }

  const host = env.EMAIL_HOST || env.SMTP_HOST || GMAIL_SMTP_HOST;
  const port = Number.parseInt(env.EMAIL_PORT || env.SMTP_PORT || String(GMAIL_SMTP_PORT), 10);
  if (!Number.isFinite(port)) {
    throw new Error("EMAIL_PORT / SMTP_PORT must be a valid number when provided");
  }

  const secure =
    typeof env.EMAIL_SECURE === "string"
      ? env.EMAIL_SECURE.toLowerCase() === "true"
      : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    // Force IPv4 — Gmail AAAA lookups on some hosts resolve to unreachable addresses.
    family: 4,
    auth: {
      user,
      pass,
    },
  });

  return createEmailProvider({
    emailTransport: transporter,
    fromAddress,
    env,
  });
}

module.exports = { createBrevoProvider, GMAIL_SMTP_HOST, GMAIL_SMTP_PORT };
