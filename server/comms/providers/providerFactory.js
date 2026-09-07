const { createConsoleProvider } = require("./consoleProvider");
const { createEmailProvider } = require("./emailProvider");
const { createWhatsAppProvider } = require("./whatsappProvider");

function createNotificationProvider(providerName = "console", dependencies = {}) {
  const normalizedProviderName = providerName.toLowerCase();

  if (normalizedProviderName === "console") {
    return createConsoleProvider(dependencies);
  }

  if (normalizedProviderName === "email") {
    return createEmailProvider(dependencies);
  }
  if (normalizedProviderName === "whatsapp") return createWhatsAppProvider(dependencies.env || process.env, dependencies);

  throw new Error(`Unsupported notification provider: ${providerName}`);
}

module.exports = { createNotificationProvider };
