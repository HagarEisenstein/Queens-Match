const { createPrismaMeetingQueryRepository } = require("../repositories/prismaMeetingQueryRepository");

describe("createPrismaMeetingQueryRepository", () => {
  it("findMeetingsAwaitingOutcome includes past scheduled and arrival_confirmed meetings", async () => {
    const calls = [];
    const prisma = {
      meeting: {
        async findMany(args) {
          calls.push(args);
          return [];
        },
      },
    };
    const repository = createPrismaMeetingQueryRepository(prisma);
    const before = new Date("2026-09-08T12:00:00.000Z");

    await repository.findMeetingsAwaitingOutcome({ before });

    expect(calls).toHaveLength(1);
    expect(calls[0].where).toEqual({
      status: { in: ["scheduled", "arrival_confirmed"] },
      scheduledTime: { lt: before },
    });
  });
});
