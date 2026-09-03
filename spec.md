# Queens Match — Spec

*Modular monolith. Confirmed decisions: single Express app / single PostgreSQL database / roles as a set (`text[]`), not an enum. See [intent.md](intent.md) for the why.*

## Problem Statement

QueenB mentees and mentors have no shared system for finding each other, agreeing on a time, confirming a meeting happened, and closing the loop with feedback. Coordination happens by hand, nobody can see which meeting pairs have stalled, and there's no record for admins to act on. The app must run the full workflow — mentor publishes availability → mentee picks a slot and submits it → mentor approves → confirm → meet → feedback — with reminders and admin oversight, built by a 3-person team on a course deadline and a limited token budget.

## Goals

1. Ship one working vertical slice of the full mentee→mentor meeting lifecycle (request through feedback) end to end, not partial pieces of many features.
2. Every meeting's state is always one of a fixed, enumerated set, and every transition between states is enforced by one shared function — no ad hoc status writes from routes.
3. Reminders and post-meeting nudges fire automatically without a message broker or second service.
4. A user holding multiple roles (mentee + mentor + admin) sees and can use every section their roles unlock, in one account, one login.
5. Ship on infrastructure the team can actually run for free for the semester (Render/Railway + Postgres, React on Vercel) — no infra work that doesn't serve a graded requirement.

## Non-Goals

- **No microservices, no message broker, no multiple databases.** The original 3-service/3-DB draft is explicitly replaced by this spec; do not partially reintroduce it.
- **No real-time chat between mentor and mentee.** Coordination happens through the mentor's published calendar and the pick-and-approve flow only, not free-form messaging.
- **No double-booking or multi-select.** A mentee can hold one pending slot pick per meeting request at a time — not several candidate slots submitted at once.
- **No payment or credentialing/verification of mentors.** Mentor status is self-declared via `roles`.
- **No mobile app.** Web only (responsive is fine, but no native build).
- **WhatsApp delivery is not required for v1.** The notification abstraction ships with console/email; WhatsApp is an additive provider swapped in later with zero changes to calling code.

## User Stories

- As a **mentee**, I want to browse mentor profiles so that I can find someone relevant to my goals. (req 3)
- As a **mentor**, I want to insert the time blocks I'm available for into a calendar ahead of time so that mentees can see my real availability without back-and-forth. (req 4.2)
- As a **mentee**, I want to view a mentor's open calendar and pick exactly one slot at a time to submit so that my request is unambiguous and easy for the mentor to review. (req 4.3)
- As a **mentor**, I want to approve or reject a mentee's submitted slot so that I control what actually goes on my calendar. (req 4.4)
- As a **mentor**, I want to be notified when a mentee submits a slot pick, and the mentee to be notified once I approve it, so that both sides know where the request stands. (req 4.5)
- As a **mentee**, I want to pick a different open slot if my first pick gets rejected, once, so that a single rejection doesn't dead-end the match. (req 4.6)
- As either **mentee or mentor**, I want to flag that I can't make a scheduled meeting and get one re-coordination attempt so that a single conflict doesn't kill the match. (req 5)
- As a **mentee or mentor**, I want a reminder before the meeting and a prompt to confirm arrival so that no-shows are visible. (req 6)
- As a **mentee or mentor**, I want to report whether the meeting actually happened, and if not, be asked whether to try again once, so that stalled matches get resolved instead of silently rotting. (req 7)
- As a **mentee or mentor**, I want to be nudged if I haven't submitted feedback so that feedback actually gets collected. (req 8)
- As a **mentor**, I want an automatic thank-you after a completed meeting so that the platform acknowledges my time. (req 9)
- As an **admin**, I want a report of meetings filterable by status and participant so that I can see where things stand. (req 10)
- As an **admin**, I want a calendar view of meetings so that I can see load and timing at a glance. (req 11)
- As an **admin**, I want to open a single meeting's detail so that I can investigate a specific case. (req 12)
- As an **admin**, I want a list of all users so that I can see who's on the platform. (req 13)
- As an **admin**, I want a user detail view showing mentoring counts so that I can see who's overloaded or inactive. (req 14)
- As an **admin**, I want automatic alerts for not-completed meetings, stalled pre-arrival meetings, overdue feedback, and overloaded mentors so that I don't have to manually audit the whole meeting table. (req 15)
- As a **user with multiple roles**, I want to see mentee, mentor, and admin sections in the same account based on my `roles`, so that I'm not forced into one exclusive dashboard.

## Functional Requirements

| # | Requirement |
|---|---|
| 3 | Mentee can browse a list of mentors (`GET /api/users/mentors`) and view a mentor's detail page. |
| 4.1 | Mentor can create/edit their `mentor_profiles` row at any time (background, `advice_topics`, `max_meetings`, `meeting_length_minutes`, `is_active`). |
| 4.2 | Mentor inserts open time blocks into their own standing calendar (`availability_blocks`), independent of any specific mentee, whenever they like. |
| 4.3 | Mentee opens a mentor's calendar of open blocks and submits **exactly one** block as their pick → a meeting is created (or updated) in `pending_mentor_approval`; that block is held (`meeting_id` set on it) but not yet booked. Mentee cannot submit more than one pending pick per meeting request at a time. |
| 4.4 | Mentor approves the submitted pick → meeting moves to `scheduled`, `scheduled_time` set to the block's `start_time`, block's `is_booked = true`. Mentor rejects the pick → block is released (`meeting_id` cleared, still open on the calendar) and meeting returns to `pending_mentee_selection` so the mentee can pick a different open block — **guarded** the same way as before: only if `recoordination_count == 0` (increments to 1 on this return); if `recoordination_count` is already 1, the meeting is force-rejected (→ `rejected`) instead of releasing the block again. |
| 4.5 | On submission, the mentor is notified a pick is awaiting approval; on approval, the mentee is notified the meeting is scheduled — both via the notification abstraction. |
| 4.6 | Covered by 4.3/4.4: a mentee's re-pick after a mentor rejection is the "ask for different times" case, and shares the same `recoordination_count` guard (one retry only). |
| 5 | After a meeting is `scheduled`, either party may report they can't make it. Same guard as 4.6: allowed once (`recoordination_count == 0` → increments to 1, returns to `pending_mentor_times`); a second such report on the same meeting is rejected. |
| 6 | 2 days before `scheduled_time`, a reminder is sent to both parties and each is asked to confirm arrival. When both confirm (`mentee_arrival_confirmed` and `mentor_arrival_confirmed` both true) → `arrival_confirmed`. |
| 7 | After `scheduled_time` passes, the system checks whether the meeting happened. If yes → `completed`, feedback requested from both. If no → `not_completed`, both parties are asked "still want to meet?" — if both say yes, one re-coordination is allowed (same `recoordination_count` guard as 4.6/5); otherwise the meeting stays `not_completed`. |
| 8 | If a user hasn't submitted feedback, they are reminded every 2 days, repeating indefinitely until that user's feedback is submitted. |
| 9 | After a meeting reaches `completed`, the mentor automatically receives a thank-you notification. |
| 10 | Admin can view/filter a meetings report by `status` and by participant (mentee or mentor). Statuses shown map 1:1 to the meeting status enum. |
| 11 | Admin can view meetings on a calendar, color-coded by `StatusBadge`/status. |
| 12 | Admin can open a single meeting detail view (`/meetings/:id`) showing full history/state. |
| 13 | Admin can view a list of all users. |
| 14 | Admin can open a user detail view (`/admin/users/:id`) showing that user's mentoring/mentee meeting counts. |
| 15 | Scheduled scan (cron) raises admin alerts for: meetings in `not_completed`; meetings below `arrival_confirmed` whose `scheduled_time` has already passed; meetings with feedback outstanding for more than 1 week; mentors with more than 10 completed mentoring meetings. |

## The Meeting State Machine

States: `pending_mentee_selection` · `pending_mentor_approval` · `scheduled` · `arrival_confirmed` · `completed` · `not_completed` · `feedback_submitted` · `rejected` · `cancelled`.

`pending_mentee_selection` means: the meeting exists, the mentee needs to pick (or re-pick) one open block from the mentor's calendar. `pending_mentor_approval` means: the mentee has submitted a pick, the mentor needs to approve or reject it.

Transitions (implemented as `canTransition(from, to)` + `applyTransition(meeting, event)` — pure functions, the single source of truth for every status change in the app; no route or job may write `meetings.status` directly):

- `— → pending_mentee_selection`: mentee opens a request against a mentor with an open calendar (4.2/4.3 setup).
- `pending_mentee_selection → pending_mentor_approval`: mentee submits exactly one open block as their pick (4.3); block is held (`meeting_id` set, `is_booked` still false).
- `pending_mentor_approval → scheduled`: mentor approves the pick (4.4) → `scheduled_time` set, block's `is_booked = true` → notify mentee (4.5).
- `pending_mentor_approval → pending_mentee_selection`: mentor rejects the pick (4.4/4.6) — **guarded**: only if `recoordination_count == 0`; block is released (`meeting_id` cleared) and count increments to 1.
- `pending_mentor_approval → rejected`: mentor rejects the pick **and `recoordination_count == 1` already** — forced reject, no further re-pick loop.
- `scheduled → pending_mentee_selection`: either party reports they can't make it (5) — **same guard**: only if `recoordination_count == 0`; increments to 1, previously booked block is released.
- `scheduled → arrival_confirmed`: both `mentee_arrival_confirmed` and `mentor_arrival_confirmed` are true (6).
- `arrival_confirmed → completed`: meeting confirmed as happened (7) → feedback requested.
- `arrival_confirmed → not_completed`: meeting confirmed as not happened (7).
- `not_completed → pending_mentee_selection`: both parties say "still want to meet?" — **same guard**: only if `recoordination_count == 0`; increments to 1.
- `not_completed → not_completed`: guard fails (already re-coordinated once) — terminal for this pair.
- `completed → feedback_submitted`: feedback received from both parties.

**The `recoordination_count` guard is a single counter per meeting shared across all re-coordination triggers (mentor rejecting a pick, either side reporting a no-show conflict, or a post-meeting "try again")** — it is not separate counters per trigger. Once a meeting has looped back to `pending_mentee_selection` one time for any reason, no later trigger may loop it back again; it must resolve to `rejected`, stay `not_completed`, or otherwise terminate.

This is the highest-priority unit-test target in the codebase: every arrow above, plus the guard boundary (`count == 0` succeeds, `count == 1` always rejects/terminates), needs a test.

## Data Model (PostgreSQL — one database, no exceptions)

- **users**: `id uuid pk`, `email unique`, `password_hash`, `username`, `roles text[]` (subset of `mentee`/`mentor`/`admin`), `full_name`, `photo_url`, `github_url`, `linkedin_url`, `job`, `workplace`, `years_experience`, `tech_stack text[]`, `created_at`.
- **mentor_profiles**: `user_id fk → users`, `background`, `advice_topics jsonb`, `max_meetings`, `meeting_length_minutes`, `is_active`.
- **availability_blocks**: `id pk`, `mentor_id fk → users`, `meeting_id fk → meetings` **nullable** (null = open on the calendar; set when a mentee submits it as their pick, req 4.3; cleared again if the mentor rejects the pick), `start_time`, `end_time`, `is_booked bool` (true only once the meeting reaches `scheduled`). A block is inserted by the mentor independent of any meeting and can be picked by any mentee while `meeting_id` is null.
- **meetings**: `id pk`, `mentee_id fk → users`, `mentor_id fk → users`, `status` (enum, see above), `scheduled_time` nullable, `recoordination_count int default 0`, `mentee_arrival_confirmed bool default false`, `mentor_arrival_confirmed bool default false`, `created_at`, `updated_at`.
- **feedbacks**: `id pk`, `meeting_id fk → meetings`, `submitted_by fk → users`, `rating`, `open_text`, `created_at`.
- **notification_logs**: `id pk`, `recipient_id fk → users`, `meeting_id fk → meetings`, `type`, `channel`, `status`, `sent_at`.

`roles` is always `text[]`; a user with `['mentee','mentor','admin']` is valid and sees every section their roles grant. Optional/flexible fields (e.g. `advice_topics`) live in `jsonb`/array columns on these six tables — no second data store, ever.

## API Contract

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account (strong-password validation enforced). |
| POST | `/api/auth/login` | Authenticate, return JWT. |
| GET/PUT | `/api/users/profile` | Read/update own profile. |
| GET | `/api/users/mentors` | Browse mentors (req 3). |
| POST | `/api/mentor/profile` | Create/edit mentor profile (req 4.1). |
| POST | `/api/availability` | Mentor inserts an open time block into their standing calendar (req 4.2). |
| GET | `/api/mentors/:id/availability` | Mentee views a mentor's open (unpicked) calendar blocks. |
| POST | `/api/meetings/request` | Mentee opens a meeting request against a mentor → `pending_mentee_selection`. |
| PUT | `/api/meetings/:id/select-slot` | Mentee submits exactly one open block as their pick → `pending_mentor_approval` (req 4.3). Rejected if the mentee already has a pending pick on this meeting. |
| PUT | `/api/meetings/:id/approve` | Mentor approves (→ `scheduled`) or rejects (→ `pending_mentee_selection` or forced `rejected` per the guard) the submitted pick (req 4.4/4.6). |
| PUT | `/api/meetings/:id/status` | Drives all remaining state-machine transitions: can't-make-it (5), arrival confirmation (6), happened/didn't-happen (7). Every call routes through `applyTransition` — never a raw status write. |
| POST | `/api/feedback` | Submit feedback for a meeting (req 7/feedback_submitted). |
| GET | `/api/reports/meetings` | Admin meetings report, filterable by status/participant (req 10). |
| GET | `/api/reports/users` | Admin users list + detail data (reqs 13/14). |

All routes except `/api/auth/*` and `/api/users/mentors` require a valid JWT (`auth.middleware` → `req.user = { id, roles }`); admin-only routes are additionally gated by `rbac.middleware`.

## Acceptance Criteria

- [ ] A user can hold `roles = ['mentee','mentor','admin']` simultaneously and see mentee, mentor, and admin navigation sections in the same session — no exclusive-dashboard redirect.
- [ ] A mentee can submit only one pending pick at a time per meeting request — attempting a second submission while one is already `pending_mentor_approval` is rejected by the API.
- [ ] Given a meeting in `pending_mentor_approval` with `recoordination_count == 0`, when the mentor rejects the pick, then the block is released back to the open calendar, the meeting returns to `pending_mentee_selection`, and `recoordination_count` becomes 1.
- [ ] Given a meeting with `recoordination_count == 1`, when the mentor rejects a re-submitted pick (or either party reports a second can't-make-it, or both ask to retry a second `not_completed`), then the meeting is rejected or stays terminal — it never loops back to `pending_mentee_selection` a second time.
- [ ] A mentor's open calendar blocks (`meeting_id IS NULL`) are visible to any mentee browsing that mentor; once a block is picked (`meeting_id` set) it no longer appears as open to other mentees until released.
- [ ] Given a `scheduled` meeting where both `mentee_arrival_confirmed` and `mentor_arrival_confirmed` become true, then the meeting's status becomes `arrival_confirmed`.
- [ ] Given a meeting whose `scheduled_time` has passed and is confirmed as happened, then status becomes `completed` and both parties receive a feedback request; given it's confirmed as not happened, status becomes `not_completed`.
- [ ] Given `NOTIFICATION_PROVIDER=console`, every notification event (pick submitted, pick approved/rejected, reminder, arrival check, thank-you, feedback nudge) writes a row to `notification_logs` and prints to console — no code changes needed to later switch to `EmailProvider` or `WhatsAppProvider`.
- [ ] With `NOTIFICATION_PROVIDER=console` and a feedback request left unsubmitted, a reminder fires every 2 days indefinitely (verified by shortening the cron interval) until that user's feedback is recorded — then it stops.
- [ ] Admin's `/admin` report can filter meetings by status and by participant, and every value in the status enum appears correctly labeled via `StatusBadge`.
- [ ] Admin alerts surface all four req-15 conditions: `not_completed` meetings; pre-`arrival_confirmed` meetings past their `scheduled_time`; feedback outstanding > 1 week; mentors with > 10 completed meetings.
- [ ] `npm run install-all && npm run dev` brings up client on :3000 and server on :5000 using the existing root scripts, unmodified.
- [ ] State-machine unit tests cover every transition in the table above plus both guard outcomes (count 0 succeeds, count 1 rejects/terminates), and pass under `npm test`.

## Out of Scope

- Real-time messaging/chat between mentor and mentee.
- Mentor verification, credentialing, or ranking beyond self-reported profile fields.
- Payments, subscriptions, or any monetary flow.
- Native mobile apps.
- A message broker, multiple databases, or any service split beyond the three internal Express modules (`identity`, `scheduling`, `comms`).
- WhatsApp delivery for v1 — the notification abstraction must support adding it later without touching `scheduling` or `identity` code, but shipping it is not required to consider this spec complete.

## Open Risks

- **Deployment split:** the backend's `node-cron` jobs need a persistent process — Vercel serverless cannot run them reliably. Backend + Postgres go on Render or Railway (free tier); only the React frontend goes on Vercel. This is a deliberate deviation from the course spec's Vercel-only suggestion and should be called out explicitly in submission notes.
- **Test coverage baseline:** prior instructor feedback noted only one team member wrote tests. Minimum bar for this spec: Jest + supertest smoke test per module (identity, scheduling, comms), plus full coverage of the state machine's transition table.
- **ORM choice (Prisma vs. Knex/pg):** Prisma is the default for migration speed and typed models given the limited token budget; Knex/`pg` remains an acceptable substitute only if the team wants raw-SQL practice as an explicit learning goal — pick one before Foundations work starts, don't mix.
- **`.env.example` must exist before any module work starts:** `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NOTIFICATION_PROVIDER`, plus optional `EMAIL_*`/`TWILIO_*`. Missing today — first Foundations task.
