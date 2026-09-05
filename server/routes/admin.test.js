process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../commons/db", () => ({
  meeting: { findMany: jest.fn(), findUnique: jest.fn() },
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  meetingOutcomeResponse: { findMany: jest.fn() },
  feedback: { findMany: jest.fn() },
  feedbackRequest: { findMany: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");
const prisma = require("../commons/db");

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET);
}

const MENTEE = "11111111-1111-4111-8111-111111111111";
const MENTOR = "22222222-2222-4222-8222-222222222222";
const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function appWithRoles(roles) {
  return createApp({
    jwtSecret: process.env.JWT_SECRET,
    notifications: {
      notificationRepository: { listForUser: async () => [] },
      realtimeHub: { subscribe: () => () => {}, publish() {} },
    },
    userRepository: { findPublicById: async () => ({ roles }) },
  });
}

beforeEach(() => jest.clearAllMocks());

describe("admin router — authorization", () => {
  it("rejects an unauthenticated request", async () => {
    const app = appWithRoles(["admin"]);
    const response = await request(app).get("/api/admin/meetings");
    expect(response.status).toBe(401);
  });

  it("rejects a non-admin user", async () => {
    const app = appWithRoles(["mentee"]);
    const response = await request(app)
      .get("/api/admin/meetings")
      .set("Authorization", `Bearer ${tokenFor(MENTEE, ["mentee"])}`);
    expect(response.status).toBe(403);
    expect(prisma.meeting.findMany).not.toHaveBeenCalled();
  });

  it("allows an admin user", async () => {
    prisma.meeting.findMany.mockResolvedValue([]);
    prisma.meetingOutcomeResponse.findMany.mockResolvedValue([]);
    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get("/api/admin/meetings")
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["mentor", "admin"])}`);
    expect(response.status).toBe(200);
  });
});

describe("GET /api/admin/meetings", () => {
  it("rejects an unknown status filter", async () => {
    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get("/api/admin/meetings")
      .query({ status: "completed" }) // not a real Meeting.status value
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("marks meetings with a recorded outcome as completed", async () => {
    prisma.meeting.findMany.mockResolvedValue([
      { id: MEETING_ID, status: "scheduled", mentee: {}, mentor: {}, timeSlots: [] },
    ]);
    prisma.meetingOutcomeResponse.findMany.mockResolvedValue([
      { meetingId: MEETING_ID },
    ]);

    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get("/api/admin/meetings")
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);

    expect(response.status).toBe(200);
    expect(response.body.meetings[0].isCompleted).toBe(true);
  });
});

describe("GET /api/admin/meetings/:id", () => {
  it("404s when the meeting does not exist", async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);
    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get(`/api/admin/meetings/${MEETING_ID}`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);
    expect(response.status).toBe(404);
  });

  it("returns outcome responses, feedback, and feedback requests alongside the meeting", async () => {
    prisma.meeting.findUnique.mockResolvedValue({
      id: MEETING_ID,
      status: "scheduled",
      mentee: {},
      mentor: {},
      timeSlots: [],
    });
    prisma.meetingOutcomeResponse.findMany.mockResolvedValue([{ id: "o1" }]);
    prisma.feedback.findMany.mockResolvedValue([{ id: "f1" }]);
    prisma.feedbackRequest.findMany.mockResolvedValue([{ id: "r1" }]);

    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get(`/api/admin/meetings/${MEETING_ID}`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);

    expect(response.status).toBe(200);
    expect(response.body.meeting.isCompleted).toBe(true);
    expect(response.body.outcomeResponses).toEqual([{ id: "o1" }]);
    expect(response.body.feedback).toEqual([{ id: "f1" }]);
    expect(response.body.feedbackRequests).toEqual([{ id: "r1" }]);
  });
});

describe("GET /api/admin/users", () => {
  it("derives mentor/mentee meeting counts from the relation _count", async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: MENTOR,
        email: "alice@example.com",
        username: "alice",
        fullName: "Alice",
        roles: ["mentor"],
        createdAt: new Date().toISOString(),
        _count: { meetingsAsMentor: 3, meetingsAsMentee: 0 },
      },
    ]);

    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);

    expect(response.status).toBe(200);
    expect(response.body.users[0]).toMatchObject({
      mentorMeetingCount: 3,
      menteeMeetingCount: 0,
    });
    expect(response.body.users[0]._count).toBeUndefined();
  });
});

describe("GET /api/admin/alerts", () => {
  it("groups alerts by concrete schema signals, not invented statuses", async () => {
    prisma.meetingOutcomeResponse.findMany
      .mockResolvedValueOnce([{ meetingId: MEETING_ID, happened: false }]) // notHappened
      .mockResolvedValueOnce([{ meetingId: MEETING_ID }]); // allOutcomeMeetingIds
    prisma.feedbackRequest.findMany.mockResolvedValue([]);
    prisma.meeting.findMany
      .mockResolvedValueOnce([
        { id: MEETING_ID, status: "scheduled", scheduledTime: null, mentee: {}, mentor: {} },
      ]) // notCompletedMeetings
      .mockResolvedValueOnce([{ id: MEETING_ID, mentorId: MENTOR }]); // completedMeetings
    prisma.user.findMany.mockResolvedValue([]);

    const app = appWithRoles(["admin"]);
    const response = await request(app)
      .get("/api/admin/alerts")
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["admin"])}`);

    expect(response.status).toBe(200);
    expect(response.body.alerts.meetingsNotCompleted).toHaveLength(1);
    expect(response.body.alerts.meetingsNotCompleted[0].id).toBe(MEETING_ID);
    // one recorded outcome, below the >10 threshold — should not be flagged as overloaded
    expect(response.body.alerts.overloadedMentors).toHaveLength(0);
  });
});
