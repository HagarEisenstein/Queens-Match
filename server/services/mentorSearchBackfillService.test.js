const {
  createMentorSearchBackfillService,
} = require("./mentorSearchBackfillService");

const mentorIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function createHarness(ids = mentorIds) {
  const prismaClient = {
    mentorProfile: {
      findMany: jest.fn().mockResolvedValue(ids.map((id) => ({ id }))),
    },
  };
  const generateMentorSearchEmbedding = jest
    .fn()
    .mockImplementation(async (mentorProfileId) => ({
      mentorProfileId,
      updated: true,
      dimensions: 768,
      model: "gemini-embedding-001",
    }));
  const service = createMentorSearchBackfillService({
    prismaClient,
    generateMentorSearchEmbedding,
  });
  return { service, prismaClient, generateMentorSearchEmbedding };
}

describe("mentor search embedding backfill service", () => {
  it("loads only mentor profile IDs in deterministic order", async () => {
    const { service, prismaClient } = createHarness([]);

    await service.backfillMentorSearchEmbeddings();

    expect(prismaClient.mentorProfile.findMany).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { id: "asc" },
    });
  });

  it("returns zero counts when there are no mentors", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness([]);

    await expect(service.backfillMentorSearchEmbeddings()).resolves.toEqual({
      total: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    });
    expect(generateMentorSearchEmbedding).not.toHaveBeenCalled();
  });

  it("counts every generated or refreshed embedding as updated", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness();

    const summary = await service.backfillMentorSearchEmbeddings();

    expect(summary).toEqual({
      total: 3,
      updated: 3,
      skipped: 0,
      failed: 0,
      failures: [],
    });
    expect(generateMentorSearchEmbedding.mock.calls).toEqual(
      mentorIds.map((id) => [id])
    );
  });

  it("counts already-current embeddings as skipped", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness();
    generateMentorSearchEmbedding.mockImplementation(async (mentorProfileId) => ({
      mentorProfileId,
      updated: false,
    }));

    await expect(service.backfillMentorSearchEmbeddings()).resolves.toEqual({
      total: 3,
      updated: 0,
      skipped: 3,
      failed: 0,
      failures: [],
    });
  });

  it("reports mixed updated and skipped results", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness();
    generateMentorSearchEmbedding
      .mockResolvedValueOnce({ updated: true })
      .mockResolvedValueOnce({ updated: false })
      .mockResolvedValueOnce({ updated: true });

    await expect(service.backfillMentorSearchEmbeddings()).resolves.toEqual({
      total: 3,
      updated: 2,
      skipped: 1,
      failed: 0,
      failures: [],
    });
  });

  it("continues sequentially after a mentor fails and returns safe metadata", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness();
    let inFlight = 0;
    let maximumInFlight = 0;
    generateMentorSearchEmbedding.mockImplementation(async (id) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      if (id === mentorIds[1]) {
        const error = new Error("Gemini request exposed provider details");
        error.apiKey = "private-api-key";
        error.embedding = [0.1, 0.2, 0.3];
        throw error;
      }
      return {
        mentorProfileId: id,
        updated: true,
        documentText: "private mentor search document",
      };
    });

    const summary = await service.backfillMentorSearchEmbeddings();

    expect(maximumInFlight).toBe(1);
    expect(generateMentorSearchEmbedding.mock.calls).toEqual(
      mentorIds.map((id) => [id])
    );
    expect(summary).toEqual({
      total: 3,
      updated: 2,
      skipped: 0,
      failed: 1,
      failures: [
        {
          mentorProfileId: mentorIds[1],
          code: "EMBEDDING_GENERATION_FAILED",
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("Gemini");
    expect(JSON.stringify(summary)).not.toContain("private-api-key");
    expect(JSON.stringify(summary)).not.toContain("documentText");
    expect(JSON.stringify(summary)).not.toContain("0.1");
  });

  it("remains idempotent by honoring the existing generator's skip result", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness([
      mentorIds[0],
    ]);
    generateMentorSearchEmbedding
      .mockResolvedValueOnce({ updated: true })
      .mockResolvedValueOnce({ updated: false });

    const firstRun = await service.backfillMentorSearchEmbeddings();
    const secondRun = await service.backfillMentorSearchEmbeddings();

    expect(firstRun).toMatchObject({ updated: 1, skipped: 0, failed: 0 });
    expect(secondRun).toMatchObject({ updated: 0, skipped: 1, failed: 0 });
    expect(generateMentorSearchEmbedding).toHaveBeenCalledTimes(2);
  });

  it("rejects an overlapping run with a safe 409 application error", async () => {
    const { service, generateMentorSearchEmbedding } = createHarness([
      mentorIds[0],
    ]);
    let finishFirstRun;
    let markFirstRunStarted;
    const firstRunStarted = new Promise((resolve) => {
      markFirstRunStarted = resolve;
    });
    generateMentorSearchEmbedding.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishFirstRun = resolve;
          markFirstRunStarted();
        })
    );

    const firstRun = service.backfillMentorSearchEmbeddings();
    await firstRunStarted;

    await expect(service.backfillMentorSearchEmbeddings()).rejects.toMatchObject({
      status: 409,
      code: "MENTOR_EMBEDDING_BACKFILL_IN_PROGRESS",
      message: "Mentor embedding backfill is already running.",
    });

    finishFirstRun({ updated: true });
    await firstRun;
  });

  it("releases the overlap guard when loading mentor IDs fails", async () => {
    const { service, prismaClient } = createHarness([]);
    prismaClient.mentorProfile.findMany
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce([]);

    await expect(service.backfillMentorSearchEmbeddings()).rejects.toThrow(
      "database unavailable"
    );
    await expect(service.backfillMentorSearchEmbeddings()).resolves.toMatchObject({
      total: 0,
    });
  });
});
