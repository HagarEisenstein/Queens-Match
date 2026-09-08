const nodemailer = require("nodemailer");
const { createEmailProvider } = require("./emailProvider");

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;

/** Render exposes unset variables as empty strings, which must not win over a default. */
function readEnv(env, ...keys) {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/**
 * Nodemailer SMTP provider used when NOTIFICATION_PROVIDER=email.
 * Defaults to Gmail over IPv4 (smtp.gmail.com:465) so Render only needs
 * SMTP_USER / SMTP_PASSWORD / EMAIL_FROM / CLIENT_URL. Optional
 * EMAIL_HOST / EMAIL_PORT / EMAIL_SECURE still override the defaults for
 * non-Gmail SMTP.
 */
function createBrevoProvider(env = process.env, { logger = console } = {}) {
  const user = readEnv(env, "EMAIL_USER", "SMTP_USER");
  const pass = readEnv(env, "EMAIL_PASSWORD", "SMTP_PASSWORD");
  const fromAddress = readEnv(env, "EMAIL_FROM");

  if (!user || !pass || !fromAddress) {
    throw new Error("SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are required for email");
  }

  const host = readEnv(env, "EMAIL_HOST", "SMTP_HOST") || GMAIL_SMTP_HOST;
  const port = Number.parseInt(
    readEnv(env, "EMAIL_PORT", "SMTP_PORT") || String(GMAIL_SMTP_PORT),
    10
  );
  if (!Number.isFinite(port)) {
    throw new Error("EMAIL_PORT / SMTP_PORT must be a valid number when provided");
  }

  const configuredSecure = readEnv(env, "EMAIL_SECURE");
  const secure = configuredSecure ? configuredSecure.toLowerCase() === "true" : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    // Force IPv4 — Gmail AAAA lookups on Render resolve to unreachable
    // addresses and the send fails with ENETUNREACH.
    family: 4,
    auth: {
      user,
      pass,
    },
  });

  // Startup diagnostics only: host, port and mode. Never credentials.
  logger.info?.(
    `[email] provider=${host === GMAIL_SMTP_HOST ? "gmail" : "smtp"} smtp=${host}:${port} secure=${secure}`
  );

  const provider = createEmailProvider({
    emailTransport: transporter,
    fromAddress,
    clientUrl: readEnv(env, "CLIENT_URL"),
    env,
  });

  return { ...provider, smtp: { host, port, secure, family: 4 } };
}

module.exports = { createBrevoProvider, GMAIL_SMTP_HOST, GMAIL_SMTP_PORT };
