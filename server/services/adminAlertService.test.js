const { createAdminAlertService } = require("./adminAlertService");

const mentee = "11111111-1111-4111-8111-111111111111";
const meeting = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fakePrisma() {
  return {
    adminAlert: {
      upsert: jest.fn(async ({ where, create }) => ({ idempotencyKey: where.idempotencyKey, ...create })),
      findMany: jest.fn(async () => []),
      update: jest.fn(async ({ where, data }) => ({ idempotencyKey: where.idempotencyKey, ...data })),
    },
    meeting: { findMany: jest.fn(async () => []) },
    user: { findMany: jest.fn(async () => []), update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })) },
  };
}

describe("adminAlertService", () => {
  it("uses a stable key so repeated scans upsert the same exceptional meeting", async () => {
    const prisma = fakePrisma();
    prisma.meeting.findMany.mockResolvedValue([{ id: meeting, status: "cancelled", createdAt: new Date(), scheduledTime: null, menteeId: mentee, mentorId: "22222222-2222-4222-8222-222222222222" }]);
    const service = createAdminAlertService({ prisma, now: () => new Date("2026-09-05T00:00:00.000Z") });

    await service.scan();
    await service.scan();

    expect(prisma.adminAlert.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.adminAlert.upsert.mock.calls[0][0].where).toEqual({ idempotencyKey: `cancelled_meeting:${meeting}` });
    expect(prisma.adminAlert.upsert.mock.calls[1][0].where).toEqual({ idempotencyKey: `cancelled_meeting:${meeting}` });
  });

  it("creates a mentee inactivity warning and a one-week deletion schedule", async () => {
    const prisma = fakePrisma();
    prisma.user.findMany.mockResolvedValue([{ id: mentee, lastActivityAt: new Date("2025-08-01T00:00:00.000Z") }]);
    const notifications = { send: jest.fn() };
    const service = createAdminAlertService({ prisma, notificationService: notifications, now: () => new Date("2026-09-05T00:00:00.000Z") });

    await service.scan();

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: mentee }, data: expect.objectContaining({ deletionScheduledAt: new Date("2026-09-12T00:00:00.000Z") }) }));
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({ recipientId: mentee, emailEligible: false }));
  });

  it("requires an explicit approved or resolved review state", async () => {
    const prisma = fakePrisma();
    const service = createAdminAlertService({ prisma });
    await expect(service.review("key", mentee, { status: "ignored" })).rejects.toMatchObject({ code: "INVALID_ALERT_REVIEW" });
    await expect(service.review("key", mentee, { status: "approved", note: "checked" })).resolves.toMatchObject({ status: "approved" });
  });
});
