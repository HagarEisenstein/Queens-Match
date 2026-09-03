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
});

const MEETING_ACTION = Object.freeze({
  OFFER_TIMES: "OFFER_TIMES",
  REJECT: "REJECT",
  SELECT_TIME: "SELECT_TIME",
});

// The status a meeting is born in the moment a mentee expresses interest [R4.2].
const INITIAL_STATUS = MEETING_STATUS.PENDING_MENTOR_TIMES;

// Statuses from which no further coordination is expected within Epic 3.
// (Epic 4 later reopens `scheduled` for re-coordination; that lives elsewhere.)
const TERMINAL_STATUSES = Object.freeze([
  MEETING_STATUS.SCHEDULED,
  MEETING_STATUS.REJECTED,
]);

/**
 * The complete transition table. A status maps to the actions it allows and
 * the status each action lands on. Anything not listed here is, by definition,
 * illegal — there is no implicit fall-through.
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
  },
  [MEETING_STATUS.SCHEDULED]: {},
  [MEETING_STATUS.REJECTED]: {},
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
