const nodemailer = require("nodemailer");
const { createEmailProvider } = require("./emailProvider");

function createBrevoProvider(env = process.env) {
  if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM) {
    throw new Error("SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are required for email");
  }
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });
  return createEmailProvider({
    emailTransport: transporter,
    fromAddress: env.EMAIL_FROM,
    clientUrl: env.CLIENT_URL,
  });
}

module.exports = { createBrevoProvider };
