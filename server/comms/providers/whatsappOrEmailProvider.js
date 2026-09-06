const { createBrevoProvider } = require("./brevoProvider");

function createWhatsAppOrEmailProvider(env = process.env, dependencies = {}) {
  const whatsappProvider = dependencies.whatsappProvider;
  let emailProvider = dependencies.emailProvider;

  return {
    channel: "whatsapp-or-email",
    async send(input) {
      if (input.recipient?.phone) {
        return whatsappProvider.send(input);
      }
      emailProvider ||= createBrevoProvider(env);
      return emailProvider.send(input);
    },
  };
}

module.exports = { createWhatsAppOrEmailProvider };
