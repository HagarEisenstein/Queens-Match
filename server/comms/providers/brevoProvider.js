const nodemailer = require("nodemailer");
const { createEmailProvider } = require("./emailProvider");

function createBrevoProvider(env = process.env) {
  const host = env.EMAIL_HOST || env.SMTP_HOST;
  const port = Number.parseInt(env.EMAIL_PORT || env.SMTP_PORT || "", 10);
  const user = env.EMAIL_USER || env.SMTP_USER;
  const pass = env.EMAIL_PASSWORD || env.SMTP_PASSWORD;
  const secure =
    typeof env.EMAIL_SECURE === "string"
      ? env.EMAIL_SECURE.toLowerCase() === "true"
      : port === 465;

  if (!host || !Number.isFinite(port) || !user || !pass || !env.EMAIL_FROM) {
    throw new Error(
      "EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM are required for email"
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
  return createEmailProvider({
    emailTransport: transporter,
    fromAddress: env.EMAIL_FROM,
  });
}

module.exports = { createBrevoProvider };
