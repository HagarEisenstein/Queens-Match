const {
  MEETING_STATUS,
  MEETING_ACTION,
  INITIAL_STATUS,
  IllegalTransitionError,
  transition,
  canTransition,
  isTerminal,
} = require("./meetingStateMachine");

describe("meetingStateMachine", () => {
  describe("the golden path", () => {
    it("starts a new meeting waiting on the mentor's times", () => {
      expect(INITIAL_STATUS).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });

    it("moves to mentee selection when the mentor offers times", () => {
      expect(
        transition(MEETING_STATUS.PENDING_MENTOR_TIMES, MEETING_ACTION.OFFER_TIMES)
      ).toBe(MEETING_STATUS.PENDING_MENTEE_SELECTION);
    });

    it("moves to scheduled when the mentee selects a time", () => {
      expect(
        transition(MEETING_STATUS.PENDING_MENTEE_SELECTION, MEETING_ACTION.SELECT_TIME)
      ).toBe(MEETING_STATUS.SCHEDULED);
    });

    it("threads request → offer → select into a scheduled meeting", () => {
      let status = INITIAL_STATUS;
      status = transition(status, MEETING_ACTION.OFFER_TIMES);
      status = transition(status, MEETING_ACTION.SELECT_TIME);
      expect(status).toBe(MEETING_STATUS.SCHEDULED);
    });
  });

  describe("the rejection path", () => {
    it("moves to rejected when the mentor rejects the request", () => {
      expect(
        transition(MEETING_STATUS.PENDING_MENTOR_TIMES, MEETING_ACTION.REJECT)
      ).toBe(MEETING_STATUS.REJECTED);
    });
  });

  describe("illegal transitions are impossible", () => {
    it("rejects selecting a time before any times were offered", () => {
      expect(() =>
        transition(MEETING_STATUS.PENDING_MENTOR_TIMES, MEETING_ACTION.SELECT_TIME)
      ).toThrow(IllegalTransitionError);
    });

    it("rejects offering times after the mentee already selected", () => {
      expect(() =>
        transition(MEETING_STATUS.PENDING_MENTEE_SELECTION, MEETING_ACTION.OFFER_TIMES)
      ).toThrow(IllegalTransitionError);
    });

    it("allows post-match lifecycle actions from a scheduled meeting", () => {
      expect(transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.CANNOT_ATTEND)).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
      expect(transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.CONFIRM_ARRIVAL)).toBe(MEETING_STATUS.ARRIVAL_CONFIRMED);
    });

    it("rejects any action on a rejected meeting", () => {
      for (const action of Object.values(MEETING_ACTION)) {
        expect(() => transition(MEETING_STATUS.REJECTED, action)).toThrow(
          IllegalTransitionError
        );
      }
    });

    it("rejects an unknown status", () => {
      expect(() =>
        transition("not_a_status", MEETING_ACTION.OFFER_TIMES)
      ).toThrow(IllegalTransitionError);
    });

    it("carries a 409 / ILLEGAL_TRANSITION contract for the error middleware", () => {
      try {
        transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.REJECT);
        throw new Error("expected transition to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(IllegalTransitionError);
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe("ILLEGAL_TRANSITION");
      }
    });
  });

  describe("canTransition", () => {
    it("mirrors transition without throwing", () => {
      expect(
        canTransition(MEETING_STATUS.PENDING_MENTOR_TIMES, MEETING_ACTION.OFFER_TIMES)
      ).toBe(true);
      expect(
        canTransition(MEETING_STATUS.PENDING_MENTOR_TIMES, MEETING_ACTION.SELECT_TIME)
      ).toBe(false);
      expect(canTransition("not_a_status", MEETING_ACTION.REJECT)).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("treats feedback-complete, cancelled, and rejected as terminal", () => {
      expect(isTerminal(MEETING_STATUS.FEEDBACK_SUBMITTED)).toBe(true);
      expect(isTerminal(MEETING_STATUS.REJECTED)).toBe(true);
      expect(isTerminal(MEETING_STATUS.CANCELLED)).toBe(true);
    });

    it("treats the two pending states as non-terminal", () => {
      expect(isTerminal(MEETING_STATUS.PENDING_MENTOR_TIMES)).toBe(false);
      expect(isTerminal(MEETING_STATUS.PENDING_MENTEE_SELECTION)).toBe(false);
    });
  });

  describe("lifecycle paths", () => {
    it("supports the arrival and completed paths", () => {
      expect(transition(MEETING_STATUS.ARRIVAL_CONFIRMED, MEETING_ACTION.CONFIRM_HAPPENED)).toBe(MEETING_STATUS.COMPLETED);
      expect(transition(MEETING_STATUS.COMPLETED, MEETING_ACTION.SUBMIT_FEEDBACK)).toBe(MEETING_STATUS.FEEDBACK_SUBMITTED);
      expect(transition(MEETING_STATUS.ARRIVAL_CONFIRMED, MEETING_ACTION.CONFIRM_NOT_HAPPENED)).toBe(MEETING_STATUS.NOT_COMPLETED);
      expect(transition(MEETING_STATUS.NOT_COMPLETED, MEETING_ACTION.RETRY_AFTER_NOSHOW)).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });

    it("supports one request-more-times transition", () => {
      expect(transition(MEETING_STATUS.PENDING_MENTEE_SELECTION, MEETING_ACTION.REQUEST_MORE_TIMES)).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });
  });
});
