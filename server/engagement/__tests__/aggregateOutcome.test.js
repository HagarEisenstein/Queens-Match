const { aggregateOutcome } = require("../aggregateOutcome");

describe("aggregateOutcome", () => {
  it("returns awaiting_responses when either side is missing", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: true },
        mentorOutcome: null,
      })
    ).toEqual({ status: "awaiting_responses", mentorGhosted: false });

    expect(
      aggregateOutcome({
        menteeOutcome: null,
        mentorOutcome: { happened: true },
      })
    ).toEqual({ status: "awaiting_responses", mentorGhosted: false });
  });

  it("returns admin_review when happened answers conflict", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: true, absentParty: null },
        mentorOutcome: { happened: false, absentParty: "self" },
      })
    ).toMatchObject({ status: "admin_review" });
  });

  it("returns completed when both say the meeting happened", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: true },
        mentorOutcome: { happened: true },
      })
    ).toEqual({ status: "completed", mentorGhosted: false });
  });

  it("returns retry_pending when both want another try and retry unused", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, stillWantToMeet: true, absentParty: "unclear" },
        mentorOutcome: { happened: false, stillWantToMeet: true, absentParty: "unclear" },
        retryAfterNoshowUsed: false,
      })
    ).toEqual({ status: "retry_pending", mentorGhosted: false });
  });

  it("returns not_completed when retry already used or parties decline", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, stillWantToMeet: true, absentParty: "self" },
        mentorOutcome: { happened: false, stillWantToMeet: true, absentParty: "other" },
        retryAfterNoshowUsed: true,
      })
    ).toMatchObject({ status: "not_completed" });

    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, stillWantToMeet: false, absentParty: "self" },
        mentorOutcome: { happened: false, stillWantToMeet: true, absentParty: "other" },
      })
    ).toMatchObject({ status: "not_completed" });
  });

  it("detects mentorGhosted from mentee or mentor absentParty answers", () => {
    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, absentParty: "other", stillWantToMeet: false },
        mentorOutcome: { happened: false, absentParty: "unclear", stillWantToMeet: false },
      }).mentorGhosted
    ).toBe(true);

    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, absentParty: "both", stillWantToMeet: false },
        mentorOutcome: { happened: false, absentParty: "unclear", stillWantToMeet: false },
      }).mentorGhosted
    ).toBe(true);

    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, absentParty: "unclear", stillWantToMeet: false },
        mentorOutcome: { happened: false, absentParty: "self", stillWantToMeet: false },
      }).mentorGhosted
    ).toBe(true);

    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, absentParty: "unclear", stillWantToMeet: false },
        mentorOutcome: { happened: false, absentParty: "both", stillWantToMeet: false },
      }).mentorGhosted
    ).toBe(true);

    expect(
      aggregateOutcome({
        menteeOutcome: { happened: false, absentParty: "self", stillWantToMeet: false },
        mentorOutcome: { happened: false, absentParty: "other", stillWantToMeet: false },
      }).mentorGhosted
    ).toBe(false);
  });
});
