# High-performance mentor matching

## Decisions

- Preserve the existing public `GET /api/mentors` route and its bare-array response.
- Keep the no-topic call on the exact legacy Prisma query and ordering.
- Accept optional repeated `adviceTopics` query parameters; reject explicitly invalid values instead of accidentally broadening to an unfiltered fetch.
- Apply exact PostgreSQL array overlap through Prisma `hasSome` before loading any engagement history.
- Rank only the hard-filtered candidates with batched meeting, outcome, and feedback reads; never call an engagement repository once per mentor or meeting.
- Treat only mentee-authored feedback as mentor-quality feedback.
- Derive successful meetings with the existing `aggregateOutcome` function and availability with the scheduling state constants.
- Keep heuristic scores internal and fall back to the already-filtered, legacy-ordered candidates if ranking history cannot be read.
- Do not change the Prisma schema, migrations, route paths, or frontend components.

## Plan

### Objective

Add an opt-in, database-filtered mentor matching path with deterministic engagement ranking while preserving every existing unfiltered consumer.

### Tasks

1. Add a focused ranking service in `server/services/mentorMatchingService.js`.
2. Extend `server/services/mentorProfilesService.js` with optional topic filtering and safe ranking fallback.
3. Parse and validate optional topic-array query input in `server/routes/mentors.js`.
4. Add service, ranking, and route regression tests.

### Verification criteria

- No query parameters produce the original Prisma call and raw-array response.
- Topic requests use `adviceTopics.hasSome` and never return an unfiltered fallback.
- Ranking performs at most one meetings read, one outcomes read, and one feedback read regardless of candidate count.
- Outcomes use the existing aggregation rules; mentor self-feedback is ignored; current meeting load uses scheduling states and excludes past scheduled meetings.
- Ranking metadata is not added to response objects.
- Existing server and client test suites remain green.

## Verify

- Focused matching/service tests: 16 passing.
- Full server Jest suite: 12 suites / 116 tests passing.
- Server Node test suite: 13 tests passing.
- Full client suite: 10 suites / 34 tests passing.
- Prisma schema validation: passing.
- Syntax checks and `git diff --check`: passing.
- Post-implementation review: ranking responsibilities split into focused helpers; no remaining correctness or regression findings.
