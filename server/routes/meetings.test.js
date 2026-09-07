process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

jest.mock("../modules/scheduling/schedulingService", () => ({
  requestMeeting: jest.fn(),
  offerTimes: jest.fn(),
  rejectMeeting: jest.fn(),
  selectTime: jest.fn(),
  getMeetingById: jest.fn(),
  listMeetingsForUser: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { createApp } = require("../app");
const {
  requestMeeting,
  offerTimes,
  rejectMeeting,
  selectTime,
  getMeetingById,
  listMeetingsForUser,
} = require("../modules/scheduling/schedulingService");

function tokenFor(userId, roles = ["mentee"]) {
  return jwt.sign({ id: userId, roles }, process.env.JWT_SECRET);
}

const stubNotifications = {
  notificationRepository: { listForUser: async () => [] },
  realtimeHub: { subscribe: () => () => {}, publish() {} },
};

const app = createApp({
  jwtSecret: process.env.JWT_SECRET,
  notifications: stubNotifications,
  userRepository: { findPublicById: async () => null },
});

const MENTOR = "22222222-2222-4222-8222-222222222222";
const MEETING_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SLOT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => jest.clearAllMocks());

describe("POST /api/meetings", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(app).post("/api/meetings").send({ mentorId: MENTOR });
    expect(response.status).toBe(401);
    expect(requestMeeting).not.toHaveBeenCalled();
  });

  it("validates the mentorId", async () => {
    const response = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ mentorId: "not-a-uuid" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(requestMeeting).not.toHaveBeenCalled();
  });

  it("creates a meeting for the authenticated mentee", async () => {
    requestMeeting.mockResolvedValue({ id: MEETING_ID, status: "pending_mentor_times" });

    const response = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ mentorId: MENTOR });

    expect(response.status).toBe(201);
    expect(requestMeeting).toHaveBeenCalledWith({ menteeId: "u1", mentorId: MENTOR });
    expect(response.body.id).toBe(MEETING_ID);
  });

  it("rejects a request from a mentor-only account", async () => {
    const response = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${tokenFor("u1", ["mentor"])}`)
      .send({ mentorId: MENTOR });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(requestMeeting).not.toHaveBeenCalled();
  });

  it("allows a request from a user who is both mentor and mentee", async () => {
    requestMeeting.mockResolvedValue({ id: MEETING_ID, status: "pending_mentor_times" });

    const response = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${tokenFor("u1", ["mentor", "mentee"])}`)
      .send({ mentorId: MENTOR });

    expect(response.status).toBe(201);
    expect(requestMeeting).toHaveBeenCalledWith({ menteeId: "u1", mentorId: MENTOR });
  });
});

describe("GET /api/meetings", () => {
  it("lists the caller's meetings", async () => {
    listMeetingsForUser.mockResolvedValue([{ id: MEETING_ID }]);

    const response = await request(app)
      .get("/api/meetings")
      .set("Authorization", `Bearer ${tokenFor("u1")}`);

    expect(response.status).toBe(200);
    expect(listMeetingsForUser).toHaveBeenCalledWith("u1");
    expect(response.body).toEqual([{ id: MEETING_ID }]);
  });
});

describe("POST /api/meetings/:id/offer-times", () => {
  it("validates that slots are present", async () => {
    const response = await request(app)
      .post(`/api/meetings/${MEETING_ID}/offer-times`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["mentor"])}`)
      .send({ slots: [] });
    expect(response.status).toBe(400);
    expect(offerTimes).not.toHaveBeenCalled();
  });

  it("forwards a valid offer to the service", async () => {
    offerTimes.mockResolvedValue({ id: MEETING_ID, status: "pending_mentee_selection" });
    const slots = [
      { startTime: "2026-10-01T10:00:00.000Z", endTime: "2026-10-01T10:30:00.000Z" },
    ];

    const response = await request(app)
      .post(`/api/meetings/${MEETING_ID}/offer-times`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["mentor"])}`)
      .send({ slots });

    expect(response.status).toBe(200);
    expect(offerTimes).toHaveBeenCalledWith({ meetingId: MEETING_ID, actorId: MENTOR, slots });
  });
});

describe("POST /api/meetings/:id/reject", () => {
  it("forwards the rejection to the service", async () => {
    rejectMeeting.mockResolvedValue({ id: MEETING_ID, status: "rejected" });

    const response = await request(app)
      .post(`/api/meetings/${MEETING_ID}/reject`)
      .set("Authorization", `Bearer ${tokenFor(MENTOR, ["mentor"])}`);

    expect(response.status).toBe(200);
    expect(rejectMeeting).toHaveBeenCalledWith({ meetingId: MEETING_ID, actorId: MENTOR });
  });
});

describe("POST /api/meetings/:id/select-time", () => {
  it("validates the slotId", async () => {
    const response = await request(app)
      .post(`/api/meetings/${MEETING_ID}/select-time`)
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ slotId: "nope" });
    expect(response.status).toBe(400);
    expect(selectTime).not.toHaveBeenCalled();
  });

  it("forwards a valid selection to the service", async () => {
    selectTime.mockResolvedValue({ id: MEETING_ID, status: "scheduled" });

    const response = await request(app)
      .post(`/api/meetings/${MEETING_ID}/select-time`)
      .set("Authorization", `Bearer ${tokenFor("u1")}`)
      .send({ slotId: SLOT_ID });

    expect(response.status).toBe(200);
    expect(selectTime).toHaveBeenCalledWith({ meetingId: MEETING_ID, actorId: "u1", slotId: SLOT_ID });
  });
});

describe("GET /api/meetings/:id", () => {
  it("returns a meeting the service authorizes", async () => {
    getMeetingById.mockResolvedValue({ id: MEETING_ID });

    const response = await request(app)
      .get(`/api/meetings/${MEETING_ID}`)
      .set("Authorization", `Bearer ${tokenFor("u1")}`);

    expect(response.status).toBe(200);
    expect(getMeetingById).toHaveBeenCalledWith(MEETING_ID, "u1");
  });

  it("surfaces a service 403 in the standard error shape", async () => {
    getMeetingById.mockRejectedValue(Object.assign(new Error("nope"), { statusCode: 403, code: "FORBIDDEN" }));

    const response = await request(app)
      .get(`/api/meetings/${MEETING_ID}`)
      .set("Authorization", `Bearer ${tokenFor("u1")}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
