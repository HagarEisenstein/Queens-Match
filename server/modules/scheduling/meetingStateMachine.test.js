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

    it("rejects coordination actions on a scheduled meeting", () => {
      const stillIllegal = [
        MEETING_ACTION.OFFER_TIMES,
        MEETING_ACTION.REJECT,
        MEETING_ACTION.SELECT_TIME,
        MEETING_ACTION.REQUEST_MORE_TIMES,
        MEETING_ACTION.MENTEE_REJECT,
      ];
      for (const action of stillIllegal) {
        expect(() => transition(MEETING_STATUS.SCHEDULED, action)).toThrow(
          IllegalTransitionError
        );
      }
    });

    it("rejects any action on a rejected meeting", () => {
      for (const action of Object.values(MEETING_ACTION)) {
        expect(() => transition(MEETING_STATUS.REJECTED, action)).toThrow(
          IllegalTransitionError
        );
      }
    });

    it("rejects any action on a cancelled meeting", () => {
      for (const action of Object.values(MEETING_ACTION)) {
        expect(() => transition(MEETING_STATUS.CANCELLED, action)).toThrow(
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
    it("treats rejected and cancelled as terminal", () => {
      expect(isTerminal(MEETING_STATUS.REJECTED)).toBe(true);
      expect(isTerminal(MEETING_STATUS.CANCELLED)).toBe(true);
    });

    it("treats the two pending states and scheduled as non-terminal", () => {
      expect(isTerminal(MEETING_STATUS.PENDING_MENTOR_TIMES)).toBe(false);
      expect(isTerminal(MEETING_STATUS.PENDING_MENTEE_SELECTION)).toBe(false);
      expect(isTerminal(MEETING_STATUS.SCHEDULED)).toBe(false);
    });
  });

  describe("re-coordination [R4.6]", () => {
    it("moves back to awaiting mentor times when the mentee requests more times", () => {
      expect(
        transition(MEETING_STATUS.PENDING_MENTEE_SELECTION, MEETING_ACTION.REQUEST_MORE_TIMES)
      ).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });

    it("moves to rejected when the mentee declines the offered times", () => {
      expect(
        transition(MEETING_STATUS.PENDING_MENTEE_SELECTION, MEETING_ACTION.MENTEE_REJECT)
      ).toBe(MEETING_STATUS.REJECTED);
    });
  });

  describe("cancellation [R5]", () => {
    it("moves a scheduled meeting back to awaiting mentor times on reschedule", () => {
      expect(
        transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.RESCHEDULE)
      ).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });

    it("moves a scheduled meeting to cancelled on a second can't-make-it", () => {
      expect(
        transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.CANCEL)
      ).toBe(MEETING_STATUS.CANCELLED);
    });
  });

  describe("no-show retry [R7]", () => {
    it("reopens a scheduled meeting for a fresh round of times", () => {
      expect(
        transition(MEETING_STATUS.SCHEDULED, MEETING_ACTION.REOPEN_AFTER_NO_SHOW)
      ).toBe(MEETING_STATUS.PENDING_MENTOR_TIMES);
    });
  });
});
