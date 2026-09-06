const request = require("supertest");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");

const JWT_SECRET = "notification-test-secret";
const users = {
  u1: { id: "u1", roles: ["mentee"] },
  u2: { id: "u2", roles: ["mentor"] },
};
const userRepository = {
  findPublicById: jest.fn(async (id) => users[id] || null),
  updateRoles: jest.fn(async (id, roles) => {
    users[id] = { ...(users[id] || { id }), roles };
    return users[id];
  }),
};
const records = [{ id: "n1", recipientId: "u1", title: "Meeting scheduled", readAt: null }];
const notificationRepository = {
  listForRecipient: jest.fn(async (userId) => records.filter((item) => item.recipientId === userId)),
  markRead: jest.fn(async (id, userId) => ({ count: records.some((item) => item.id === id && item.recipientId === userId) ? 1 : 0 })),
  markActionCompleted: jest.fn(async () => ({ count: 1 })),
  findAdminInviteForRecipient: jest.fn(async (id, userId) => records.find((item) => item.id === id && item.recipientId === userId && item.type === "ADMIN_INVITE") || null),
  updateAdminInviteStatus: jest.fn(async (id, userId, status) => {
    const record = records.find((item) => item.id === id && item.recipientId === userId);
    if (record) record.status = status;
    return { count: record ? 1 : 0 };
  }),
};
const notifications = {
  notificationRepository,
  realtimeHub: { subscribe: jest.fn(), publish: jest.fn() },
};

function tokenFor(id) {
  return jwt.sign({ id, roles: ["mentee"] }, JWT_SECRET);
}

describe("notifications API", () => {
  const app = createApp({ userRepository, jwtSecret: JWT_SECRET, notifications });

  beforeEach(() => {
    records.splice(1);
    delete users.u1.password_hash;
    users.u1.roles = ["mentee"];
    userRepository.findPublicById.mockClear();
    userRepository.updateRoles.mockClear();
    notificationRepository.findAdminInviteForRecipient.mockClear();
    notificationRepository.updateAdminInviteStatus.mockClear();
  });

  test("lists only the authenticated user's notifications", async () => {
    const response = await request(app).get("/api/notifications").set("Authorization", `Bearer ${tokenFor("u1")}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(records);
    expect(notificationRepository.listForRecipient).toHaveBeenCalledWith("u1");
  });

  test("marks an owned notification as read", async () => {
    const response = await request(app).patch("/api/notifications/n1/read").set("Authorization", `Bearer ${tokenFor("u1")}`);
    expect(response.status).toBe(204);
  });

  test("requires authentication", async () => {
    const response = await request(app).get("/api/notifications");
    expect(response.status).toBe(401);
  });

  test("accepts an admin invite for the current user and appends the admin role", async () => {
    records.push({
      id: "invite-1",
      recipientId: "u1",
      type: "ADMIN_INVITE",
      status: "pending",
      title: "Admin invitation",
      message: "Become an admin",
      readAt: null,
    });

    const response = await request(app)
      .post("/api/notifications/invite-1/accept-admin")
      .set("Authorization", `Bearer ${tokenFor("u1")}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("accepted");
    expect(userRepository.updateRoles).toHaveBeenCalledWith("u1", ["mentee", "admin"]);
  });
});
