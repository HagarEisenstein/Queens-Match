jest.mock("../commons/db", () => ({
  mentorProfile: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require("../commons/db");
const {
  getMentors,
  getMentorById,
  getMentorByUserId,
  upsertMentorProfile,
} = require("./mentorProfilesService");

describe("mentorProfilesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The real $transaction hands the callback a transaction client; our mock
    // client and top-level prisma mock are the same object, which is enough
    // for asserting call shape.
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
  });

  describe("getMentors", () => {
    it("lists only mentor profiles, newest edited first", async () => {
      prisma.mentorProfile.findMany.mockResolvedValue([{ id: "m1" }]);

      const result = await getMentors();

      expect(result).toEqual([{ id: "m1" }]);
      expect(prisma.mentorProfile.findMany).toHaveBeenCalledWith({
        where: { user: { roles: { has: "mentor" } } },
        include: { user: expect.any(Object) },
        orderBy: { updatedAt: "desc" },
      });
    });

    it("does not invent profiles for users who only have the mentor role", async () => {
      prisma.mentorProfile.findMany.mockResolvedValue([]);

      const result = await getMentors();

      expect(result).toEqual([]);
      expect(prisma.mentorProfile.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("getMentorById", () => {
    it("returns the profile when it belongs to a mentor", async () => {
      prisma.mentorProfile.findFirst.mockResolvedValue({ id: "m1" });

      const result = await getMentorById("m1");

      expect(result).toEqual({ id: "m1" });
      expect(prisma.mentorProfile.findFirst).toHaveBeenCalledWith({
        where: { id: "m1", user: { roles: { has: "mentor" } } },
        include: { user: expect.any(Object) },
      });
    });

    it("returns null when no matching mentor profile exists", async () => {
      prisma.mentorProfile.findFirst.mockResolvedValue(null);

      const result = await getMentorById("missing");

      expect(result).toBeNull();
    });
  });

  describe("getMentorByUserId", () => {
    it("looks up the profile by owning user id", async () => {
      prisma.mentorProfile.findUnique.mockResolvedValue({ id: "m1", userId: "u1" });

      const result = await getMentorByUserId("u1");

      expect(result).toEqual({ id: "m1", userId: "u1" });
      expect(prisma.mentorProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: "u1" },
        include: { user: expect.any(Object) },
      });
    });
  });

  describe("upsertMentorProfile", () => {
    const data = {
      background: "10 years in backend engineering.",
      adviceTopics: ["CV / Resume Review"],
      meetingsOffered: 3,
      meetingLengthMinutes: 30,
    };

    it("grants the mentor role and creates the profile for a first-time mentor", async () => {
      prisma.user.findUnique.mockResolvedValue({ roles: ["mentee"] });
      prisma.mentorProfile.upsert.mockResolvedValue({ userId: "u1", ...data });

      const result = await upsertMentorProfile("u1", data);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { roles: ["mentee", "mentor"] },
      });
      expect(prisma.mentorProfile.upsert).toHaveBeenCalledWith({
        where: { userId: "u1" },
        create: { userId: "u1", ...data },
        update: data,
        include: { user: expect.any(Object) },
      });
      expect(result).toEqual({ userId: "u1", ...data });
    });

    it("does not duplicate the mentor role for an existing mentor", async () => {
      prisma.user.findUnique.mockResolvedValue({ roles: ["mentor", "mentee"] });
      prisma.mentorProfile.upsert.mockResolvedValue({ userId: "u1", ...data });

      await upsertMentorProfile("u1", data);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { roles: ["mentor", "mentee"] },
      });
    });

    it("throws a 404 error and writes nothing when the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(upsertMentorProfile("missing-user", data)).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.mentorProfile.upsert).not.toHaveBeenCalled();
    });
  });
});
