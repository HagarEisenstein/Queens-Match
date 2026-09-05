jest.mock("../../commons/logger", () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const logger = require("../../commons/logger");
const { createSchedulingMeetingLifecyclePort } = require("./meetingLifecyclePort");
const { LIFECYCLE_EVENTS } = require("../../engagement/ports/meetingLifecyclePort");

const MEETING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

beforeEach(() => jest.clearAllMocks());

describe("createSchedulingMeetingLifecyclePort", () => {
  it("reopens the meeting when engagement emits RetryPending", async () => {
    const reopenAfterNoShow = jest.fn().mockResolvedValue({ id: MEETING_ID });
    const port = createSchedulingMeetingLifecyclePort({ reopenAfterNoShow });

    await port.emit(LIFECYCLE_EVENTS.RETRY_PENDING, { meetingId: MEETING_ID });

    expect(reopenAfterNoShow).toHaveBeenCalledWith({ meetingId: MEETING_ID });
  });

  it("ignores every other lifecycle event", async () => {
    const reopenAfterNoShow = jest.fn();
    const port = createSchedulingMeetingLifecyclePort({ reopenAfterNoShow });

    for (const eventName of Object.values(LIFECYCLE_EVENTS)) {
      if (eventName === LIFECYCLE_EVENTS.RETRY_PENDING) continue;
      await port.emit(eventName, { meetingId: MEETING_ID });
    }

    expect(reopenAfterNoShow).not.toHaveBeenCalled();
  });

  it("logs and swallows a reopen failure instead of throwing", async () => {
    const reopenAfterNoShow = jest.fn().mockRejectedValue(new Error("db down"));
    const port = createSchedulingMeetingLifecyclePort({ reopenAfterNoShow });

    await expect(
      port.emit(LIFECYCLE_EVENTS.RETRY_PENDING, { meetingId: MEETING_ID })
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to reopen meeting after a no-show retry",
      expect.objectContaining({ meetingId: MEETING_ID })
    );
  });
});
