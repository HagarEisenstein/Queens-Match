const request = require("supertest");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");

const JWT_SECRET = "notification-test-secret";
const userRepository = {};
const records = [{ id: "n1", recipientId: "u1", title: "Meeting scheduled", readAt: null }];
const notificationRepository = {
  listForRecipient: jest.fn(async (userId) => records.filter((item) => item.recipientId === userId)),
  markRead: jest.fn(async (id, userId) => ({ count: records.some((item) => item.id === id && item.recipientId === userId) ? 1 : 0 })),
  markActionCompleted: jest.fn(async () => ({ count: 1 })),
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
});
