const nodemailer = require("nodemailer");
const { createEmailProvider } = require("./emailProvider");

function createBrevoProvider(env = process.env) {
  const host = env.EMAIL_HOST || "smtp-relay.brevo.com";
  const port = Number(env.EMAIL_PORT || 587);
  if (!env.EMAIL_USER || !env.EMAIL_PASSWORD || !env.EMAIL_FROM) {
    throw new Error("EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM are required for Brevo email");
  }
  const emailTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
  });
  return createEmailProvider({ emailTransport, fromAddress: env.EMAIL_FROM });
}

module.exports = { createBrevoProvider };
