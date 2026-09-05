/**
 * The meeting state machine — the heart of Epic 3.
 *
 * The requirement statuses ARE the states (PLAN Epic 3), so we model them
 * explicitly and let a single pure function own every legal transition.
 * Nothing in here touches the database, the event bus, HTTP, or the clock:
 * given a status and an action it returns the next status, or throws. That
 * purity is what makes illegal transitions impossible and makes this the
 * primary unit-test target.
 */

const MEETING_STATUS = Object.freeze({
  PENDING_MENTOR_TIMES: "pending_mentor_times",
  PENDING_MENTEE_SELECTION: "pending_mentee_selection",
  SCHEDULED: "scheduled",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
});

const MEETING_ACTION = Object.freeze({
  OFFER_TIMES: "OFFER_TIMES",
  REJECT: "REJECT",
  SELECT_TIME: "SELECT_TIME",
  // Epic 4 — re-coordination & cancellation.
  REQUEST_MORE_TIMES: "REQUEST_MORE_TIMES",
  MENTEE_REJECT: "MENTEE_REJECT",
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL",
  REOPEN_AFTER_NO_SHOW: "REOPEN_AFTER_NO_SHOW",
});

// The status a meeting is born in the moment a mentee expresses interest [R4.2].
const INITIAL_STATUS = MEETING_STATUS.PENDING_MENTOR_TIMES;

// Statuses from which no further coordination is possible.
const TERMINAL_STATUSES = Object.freeze([
  MEETING_STATUS.REJECTED,
  MEETING_STATUS.CANCELLED,
]);

/**
 * The complete transition table. A status maps to the actions it allows and
 * the status each action lands on. Anything not listed here is, by definition,
 * illegal — there is no implicit fall-through.
 *
 * The one-iteration-only business rules (R4.6, R5, R7) are NOT encoded here —
 * this table only says what's structurally possible. The service layer decides
 * which action to fire based on each meeting's per-situation retry flags
 * (`moreTimesUsed` / `rescheduleUsed` / `retryAfterNoshowUsed`), so the pure
 * FSM stays a deterministic function of (status, action) alone.
 */
const TRANSITIONS = Object.freeze({
  [MEETING_STATUS.PENDING_MENTOR_TIMES]: {
    // Mentor marks available times [R4.3].
    [MEETING_ACTION.OFFER_TIMES]: MEETING_STATUS.PENDING_MENTEE_SELECTION,
    // Mentor declines the request [R4.3]; mentee is told and starts over [R4.4].
    [MEETING_ACTION.REJECT]: MEETING_STATUS.REJECTED,
  },
  [MEETING_STATUS.PENDING_MENTEE_SELECTION]: {
    // Mentee picks exactly one offered time [R4.4] → confirmed [R4.5].
    [MEETING_ACTION.SELECT_TIME]: MEETING_STATUS.SCHEDULED,
    // Mentee can't do any offered time and asks for a fresh set, once [R4.6].
    [MEETING_ACTION.REQUEST_MORE_TIMES]: MEETING_STATUS.PENDING_MENTOR_TIMES,
    // Mentee can't do any offered time and gives up (the forced end-state
    // after the one retry above is spent, or a voluntary decline before it).
    [MEETING_ACTION.MENTEE_REJECT]: MEETING_STATUS.REJECTED,
  },
  [MEETING_STATUS.SCHEDULED]: {
    // Either side flags "can't make it", once [R5] — back to offer-times.
    [MEETING_ACTION.RESCHEDULE]: MEETING_STATUS.PENDING_MENTOR_TIMES,
    // A second "can't make it" on the same meeting — no more retries.
    [MEETING_ACTION.CANCEL]: MEETING_STATUS.CANCELLED,
    // The meeting didn't happen and both sides still want to meet, once [R7].
    [MEETING_ACTION.REOPEN_AFTER_NO_SHOW]: MEETING_STATUS.PENDING_MENTOR_TIMES,
  },
  [MEETING_STATUS.REJECTED]: {},
  [MEETING_STATUS.CANCELLED]: {},
});

class IllegalTransitionError extends Error {
  constructor(status, action) {
    super(
      `Cannot perform "${action}" on a meeting in status "${status}".`
    );
    this.name = "IllegalTransitionError";
    this.statusCode = 409;
    this.code = "ILLEGAL_TRANSITION";
    this.status = status;
    this.action = action;
  }
}

/**
 * Compute the next status for an action, or throw IllegalTransitionError.
 * @param {string} currentStatus one of MEETING_STATUS
 * @param {string} action one of MEETING_ACTION
 * @returns {string} the resulting status
 */
function transition(currentStatus, action) {
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed || !(action in allowed)) {
    throw new IllegalTransitionError(currentStatus, action);
  }
  return allowed[action];
}

/**
 * Whether an action is legal from a status, without throwing. Handy for the
 * API and UI to decide which controls to expose.
 */
function canTransition(currentStatus, action) {
  const allowed = TRANSITIONS[currentStatus];
  return Boolean(allowed && action in allowed);
}

function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

module.exports = {
  MEETING_STATUS,
  MEETING_ACTION,
  INITIAL_STATUS,
  TERMINAL_STATUSES,
  TRANSITIONS,
  IllegalTransitionError,
  transition,
  canTransition,
  isTerminal,
};
