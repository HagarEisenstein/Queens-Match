# Queens Match — Project Plan (High-Level Breakdown)

> A community app that matchmakes **mentors** and **mentees**: a mentee finds a mentor, the mentor
> offers times, the mentee picks one, the meeting is confirmed and happens, both give feedback —
> with reminders and an admin oversight dashboard.
>
> **Architecture:** modular monolith — one Express backend (`identity` / `scheduling` / `comms`
> modules + shared middleware), one PostgreSQL database, in-process events + `node-cron` for async
> flows, and one React frontend with role-aware routing. Full technical layout lives in the
> implementation plan; **this document is the what / why / how-we-know-it-works.**

Each epic below is written as **Intent** (why it exists) → **Spec** (what it must do, mapped to the
PDF requirement numbers `[R#]`) → **E2E Validation** (how we prove it works, end to end).

---

## Requirement traceability (nothing dropped)

| PDF req | Covered by |
|---|---|
| R1 accounts + auth + registration fields | Epic 1 |
| R2 regular user vs admin | Epic 1 (roles), Epic 7 (admin) |
| R3 mentor list page | Epic 2 |
| R4.1 declare/edit mentor profile | Epic 2 |
| R4.2–4.5 request → offer times → pick → match | Epic 3 |
| R4.6, R5 request-more-times / can't-make-it (one iteration) | Epic 4 |
| R6 WhatsApp reminder + confirm arrival | Epic 5 |
| R7 did-it-happen + feedback / re-coordinate | Epic 5 + Epic 6 |
| R8 feedback reminder every 2 days | Epic 5 |
| R9 auto thank-you to mentor | Epic 5 |
| R10 admin status report + filters | Epic 7 |
| R11 admin calendar colored by status | Epic 7 |
| R12 per-meeting detail page | Epic 7 |
| R13 users list | Epic 7 |
| R14 per-user detail page | Epic 7 |
| R15 admin alerts | Epic 7 |

---

## Epic 0 — Foundations & Shared Commons

**Intent.** Give three developers one set of rails to build on so vertical slices don't collide, and
close the gap the instructor flagged (little middleware, no shared abstractions). Built **together,
first**.

**Spec.**
- One Express app composing middleware and mounting the three module routers.
- Shared "commons": JWT auth middleware (`req.user = {id, roles}`), role-based access control,
  one standard JSON error shape (400/401/403/404/500), request validation, structured logger,
  a Postgres client, and an **in-process event bus** (EventEmitter) — the agreed seam between modules.
- PostgreSQL connection + first migration (`users`). `.env.example` documenting every variable.
- Frontend shell: fix the template so the router in `App.js` actually mounts, add an `AuthContext`,
  an axios interceptor that attaches the bearer token, and a `RoleGuard` skeleton.
- **Team contract locked before splitting:** the error/response format and the event names.

**E2E Validation.**
- `npm run install-all && npm run dev` → client on `:3000`, server on `:5000`, `GET /api/health` returns healthy.
- A deliberately-thrown error in any route returns the *standard* JSON error shape (not a stack trace).
- A protected test route returns `401` without a token and `200` with a valid one.
- Frontend loads through `App.js`'s router (not the old `Dashboard`-only tree).

---

## Epic 1 — Identity & Access (owner: Dev 1)

**Intent.** Every action is tied to a real, authenticated user, and one person can wear several hats.

**Spec.**
- Registration `[R1]`: email, **strong** password (validated), username; optional profile fields —
  dev languages / tech stack, job, workplace, years of experience, photo, GitHub URL, LinkedIn URL.
- Login returns a JWT; passwords stored hashed (bcrypt), never in plaintext.
- **Roles are a set** `[R2]`: a user can be any combination of `mentee` / `mentor` / `admin`
  (explicit instructor edge case: a user who is all three). Access is by capability, not by a single role.
- View and edit own profile.

**E2E Validation.**
- Register with a weak password → rejected with a clear message; with a strong one → succeeds.
- Log in → receive a token; reload the app → session persists; log out → protected pages redirect to `/login`.
- Register a user, then grant it `mentor` + `admin` → that user can reach both mentor and admin areas.
- Inspect the DB: password is a hash, `roles` is an array.

---

## Epic 2 — Mentor Discovery & Profiles (owner: Dev 2)

**Intent.** Mentees can find the right mentor; mentors advertise what they offer and keep it current.

**Spec.**
- A user can declare herself a mentor `[R4.1]`: background, advice topics (e.g. company-specific,
  mock interview, career planning — multiple), number of mentoring meetings offered, length of each.
  **Editable at any time.**
- A dedicated page lists mentors with the details relevant to their mentoring `[R3]`.
- A mentor detail page with a clear "request a meeting" call to action.

**E2E Validation.**
- Create a mentor profile → it appears in the mentor list with the right details.
- Edit the profile (change topics / counts) → the list and detail page reflect the change immediately.
- A user who is *not* a mentor does not appear in the list.

---

## Epic 3 — Meeting Coordination (the core state machine, owner: Dev 2)

**Intent.** The heart of the app: turn "I'd like to meet her" into a confirmed, scheduled meeting —
correctly, every time. The requirement statuses **are** the states, so we model them explicitly.

**Spec.** A meeting moves through a state machine `[R4.2–4.5]`:
- Mentee expresses interest with one click `[R4.2]` → `pending_mentor_times`.
- Mentor is notified and either marks available times in a calendar-like UI `[R4.3]` → `pending_mentee_selection`,
  or rejects `[R4.3]` → `rejected` (mentee is told and starts over `[R4.4]`).
- Mentee sees the offered times and picks **exactly one** (no multi-select) `[R4.4]` → `scheduled`; mentor is notified `[R4.5]`.
- Transitions are enforced by a single pure module (illegal transitions are impossible), which is the
  primary unit-test target.

**E2E Validation.**
- Golden path: request → mentor offers 3 slots → mentee picks one → status `scheduled`, both parties
  see the confirmed time, mentor received the match notification.
- Rejection path: mentor rejects → mentee is notified and the mentor no longer owes times.
- Attempt an illegal jump (e.g. mentee "picks" before any times offered) → rejected by the state machine.

---

## Epic 4 — Re-coordination & Cancellation (owner: Dev 2)

**Intent.** Real life interferes — allow exactly one graceful retry, then force a clean resolution so
meetings don't loop forever.

**Spec.**
- If the mentee can't do any offered time, she can request more times **once** `[R4.6]`; the mentor adds
  times and the flow repeats from "offer times". After that one retry, she must reject.
- After a match, either side can flag "can't make it" `[R5]` → both return to the offer-times step,
  **one re-coordination iteration only**. A second can't-make-it → the meeting is cancelled.
- **The retry limits are per-situation, not one shared counter.** Three independent flags on the meeting —
  `more_times_used` (R4.6), `reschedule_used` (R5), `retry_after_noshow_used` (R7) — each grants exactly one
  use. Spending one does not consume the others, matching the PDF's per-stage "only one iteration" wording.

**E2E Validation.**
- Request more times once → allowed; try a second time → blocked, only "reject" remains.
- Post-match, mentor flags can't-make-it → both return to offering/picking times; the other side is notified.
- Second can't-make-it on the same meeting → blocked per the one-iteration rule.

---

## Epic 5 — Notifications, Reminders & Async Flows (owner: Dev 3)

**Intent.** Keep both sides informed and nudged without anyone babysitting the system — via a provider
we can start simply and upgrade to WhatsApp later without touching the rest of the app.

**Spec.**
- A **Notification abstraction** with pluggable providers (console → email → WhatsApp), chosen by
  config; every send is logged. WhatsApp `[R6]` is the last provider to wire in, if time allows.
- Scheduled jobs (`node-cron`, no external broker):
  - **2 days before** the scheduled time, a reminder is sent and **both sides confirm arrival** `[R6]`.
  - Post-meeting "did it happen?" check `[R7]`.
  - Feedback reminder **every 2 days** until submitted `[R8]`.
  - Automatic **thank-you** to the mentor after a completed meeting `[R9]`.
- Modules stay decoupled: `scheduling` emits events (`MeetingMatched`, `MeetingCompleted`, …);
  `comms` listens and reacts.

**E2E Validation.**
- With the console provider and shortened intervals: a scheduled meeting produces a reminder and both
  arrival-confirmation prompts; a past meeting produces the did-it-happen check; an unfilled feedback
  produces a nudge two "days" later; a completed meeting produces a thank-you.
- Every one of the above writes a row to the notification log with recipient, type, and status.
- Swap the provider config from console → email with **no code change** elsewhere and messages still send.

---

## Epic 6 — Feedback & Engagement (owner: Dev 3)

**Intent.** Close the loop on every meeting and capture whether it delivered value.

**Spec.**
- If both confirm the meeting happened `[R7]`, both receive a feedback form (rating + open text) to fill.
- If it didn't happen, ask both whether they still want to meet; if both say yes, re-coordinate once
  from the offer-times step `[R7]`.
- Feedback is stored per meeting, per submitter, and surfaces on the meeting detail page (Epic 7).

**E2E Validation.**
- Mark a meeting happened → both get a feedback form → submit → status becomes feedback-complete and the
  feedback shows on the meeting detail page.
- Mark a meeting didn't happen, both choose "still want to meet" → a fresh coordination round starts.
- One side submits, the other doesn't → the every-2-days reminder keeps targeting only the one who owes it.

---

## Epic 7 — Admin Oversight (owner: Dev 1)

**Intent.** Give the community manager a single place to see the health of all mentoring, drill into
detail, and be alerted to anything needing a human.

**Spec.**
- **Status report** of all meetings `[R10]` with the full status set, filterable **by status** and
  **by participant** (e.g. every meeting a given mentor did); a row links to the meeting detail.
- **Calendar** of all meetings, color-coded by status `[R11]` (same status→color scheme as the report).
- **Meeting detail page** `[R12]`: participants, time, status, and any feedback received.
- **Users list** `[R13]`: username, email, how much mentoring each has done; a row links to user detail.
- **User detail page** `[R14]`: registration details + count of meetings held as mentor and as mentee.
- **Admin alerts** `[R15]`: meeting didn't happen; status still before arrival-confirmed but the time
  has passed; a user who hasn't submitted feedback for over a week; a mentor who has done more than 10
  meetings (worth personal recognition).

**E2E Validation.**
- Seed several meetings across statuses → report shows all; filter by a status and by a specific mentor
  → results narrow correctly; click a row → correct detail page.
- Calendar shows the same meetings with colors matching their statuses.
- User detail shows correct mentor-count and mentee-count for a user who has played both roles.
- Force each alert condition (a past unconfirmed meeting, a >1-week-missing feedback, an 11-meeting
  mentor) → each appears in the admin alerts.

---

## Epic 8 — Deployment, Testing & Docs

**Intent.** Ship it, keep it honest, and make it maintainable/handoff-ready (an explicit project goal).

**Spec.**
- **Deploy:** React frontend on Vercel; backend + `node-cron` + PostgreSQL on a **persistent host**
  (Render/Railway) — Vercel serverless won't run the cron jobs.
- **Testing:** unit-test the state machine thoroughly (pure logic); a smoke API test per module.
- **Docs:** update the README (setup, env, run, deploy) and keep this plan current.

**E2E Validation.**
- Fresh clone → follow README → app runs locally with a real database.
- `npm test` green (state-machine cases + per-module smoke tests).
- Deployed frontend talks to the deployed backend; a cron job fires on the deployed server (visible in
  the notification log).

---

## Out of scope (v1)

- No standing/public mentor calendar — availability is **request-first** (marked per request).
- No real-time chat; coordination is request → offer-times → pick only.
- No multi-select — a mentee confirms with exactly one offered time.
- No payments, no mentor verification/credentialing, no native mobile app.
- No microservices, message broker, or second database.
- WhatsApp delivery not required for v1 (notification abstraction ships with console/email; WhatsApp is a later swap-in).

## Overarching acceptance scenario (the one test that exercises everything)

1. **Register** three users: Alice (mentor+admin), Bella (mentee), Carla (mentee). *(Epics 1, 7)*
2. Alice **creates a mentor profile**; she appears on the mentor list. *(Epic 2)*
3. Bella **requests a meeting** with Alice → Alice is notified → Alice **offers three time slots** →
   Bella **picks one** → meeting is **scheduled**, Alice notified. *(Epics 3, 5)*
4. Carla requests Alice; Alice offers times; Carla **can't do any** and **requests more once**; Alice adds
   times; Carla still can't and **rejects** — a second "more times" is blocked. *(Epic 4)*
5. The **reminder** fires for Bella's meeting; **both confirm arrival**. *(Epic 5)*
6. Post-meeting, both confirm it **happened**; both submit **feedback**; Alice gets an automatic
   **thank-you**. *(Epics 5, 6)*
7. **Admin (Alice):** the report lists both meetings with correct statuses and filters; the calendar
   colors them; Bella's meeting detail shows the feedback; the users list shows Alice's mentoring count;
   an **alert** flags Alice once she crosses 10 completed meetings. *(Epic 7)*

Passing this scenario end-to-end means the MVP meets the spec.
