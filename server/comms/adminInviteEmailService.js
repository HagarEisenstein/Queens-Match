const { createBrevoProvider } = require("./providers/brevoProvider");

function hasEmailConfiguration(env = process.env) {
  return Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD && env.EMAIL_FROM);
}

function formatExpiry(expiresAt) {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return "the configured expiration time";
  }

  return expiry.toUTCString();
}

function buildAdminInviteEmail({ inviteLink, expiresAt }) {
  return {
    title: "You're invited to become a Queens Match admin",
    message: [
      "Hello,",
      "",
      "You've been invited to join Queens Match as an admin.",
      "",
      "Use the secure link below to accept your invitation and finish setting up your account:",
      inviteLink,
      "",
      `This invite expires on ${formatExpiry(expiresAt)}.`,
      "",
      "If you were not expecting this invitation, you can safely ignore this email.",
      "",
      "Queens Match",
    ].join("\n"),
  };
}

function createAdminInviteEmailService({ env = process.env } = {}) {
  return {
    isConfigured() {
      return hasEmailConfiguration(env);
    },
    async sendInvite({ email, inviteLink, expiresAt }) {
      if (!hasEmailConfiguration(env)) {
        return {
          sent: false,
          status: "not_configured",
          message:
            "Invite email was not sent because EMAIL_USER, EMAIL_PASSWORD, or EMAIL_FROM is not configured.",
        };
      }

      const provider = createBrevoProvider(env);
      const emailContent = buildAdminInviteEmail({ inviteLink, expiresAt });
      const result = await provider.send({
        recipient: { id: email, email },
        title: emailContent.title,
        message: emailContent.message,
      });

      return {
        sent: true,
        status: "sent",
        providerMessageId: result.providerMessageId || null,
      };
    },
  };
}

module.exports = {
  buildAdminInviteEmail,
  createAdminInviteEmailService,
  hasEmailConfiguration,
};
