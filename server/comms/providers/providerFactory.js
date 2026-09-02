const { createConsoleProvider } = require("./consoleProvider");
const { createEmailProvider } = require("./emailProvider");

function createNotificationProvider(providerName = "console", dependencies = {}) {
  const normalizedProviderName = providerName.toLowerCase();

  if (normalizedProviderName === "console") {
    return createConsoleProvider(dependencies);
  }

  if (normalizedProviderName === "email") {
    return createEmailProvider(dependencies);
  }

  throw new Error(`Unsupported notification provider: ${providerName}`);
}

module.exports = { createNotificationProvider };
