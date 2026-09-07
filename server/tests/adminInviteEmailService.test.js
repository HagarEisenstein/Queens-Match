const {
  buildAdminInviteEmail,
  createAdminInviteEmailService,
} = require("../comms/adminInviteEmailService");

describe("admin invite email service", () => {
  test("builds an invite email that includes the acceptance link and expiration", () => {
    const inviteLink = "http://localhost:5000/accept-invite?token=test-token";
    const expiresAt = new Date("2030-01-02T03:04:05.000Z");

    const email = buildAdminInviteEmail({ inviteLink, expiresAt });

    expect(email.title).toBe("You're invited to become a Queens Match admin");
    expect(email.message).toContain("You've been invited to join Queens Match as an admin.");
    expect(email.message).toContain(inviteLink);
    expect(email.message).toContain(expiresAt.toUTCString());
  });

  test("reports missing SMTP configuration instead of claiming delivery", async () => {
    const service = createAdminInviteEmailService({
      env: {
        EMAIL_USER: "",
        EMAIL_PASSWORD: "",
        EMAIL_FROM: "",
      },
    });

    await expect(
      service.sendInvite({
        email: "new-admin@example.com",
        inviteLink: "http://localhost:5000/accept-invite?token=test-token",
        expiresAt: new Date("2030-01-02T03:04:05.000Z"),
      })
    ).resolves.toEqual({
      sent: false,
      status: "not_configured",
      message:
        "Invite email was not sent because EMAIL_USER, EMAIL_PASSWORD, or EMAIL_FROM is not configured.",
    });
  });
});
