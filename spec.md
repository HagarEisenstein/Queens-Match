# Queens Match — Spec

*Modular monolith. Confirmed decisions: single Express app / single PostgreSQL database / roles as a set (`text[]`), not an enum / **request-first coordination flow** (matches the PDF) / **per-situation re-coordination limits** (not one global counter). See [intent.md](intent.md) for the why.*

## Problem Statement

QueenB mentees and mentors have no shared system for finding each other, agreeing on a time, confirming a meeting happened, and closing the loop with feedback. Coordination happens by hand, nobody can see which meeting pairs have stalled, and there's no record for admins to act on. The app must run the full workflow — mentee requests a meeting → mentor marks the times she's free (or rejects) → mentee picks one → confirm → meet → feedback — with reminders and admin oversight, built by a 3-person team on a course deadline and a limited token budget.

## Coordination model: request-first (matches the PDF)

Availability is **reactive to a specific request**, not a standing public calendar. The PDF (R4.3) is explicit: *"the system notifies the mentor that someone wants to meet, and lets her mark, in a calendar-like interface, the times she's available."* A mentor marks times **after** a named mentee has expressed interest — she does not publish an open calendar ahead of time. This is what the PDF's R10 status list encodes (it begins with *"waiting for mentor to mark times in the calendar"*).

## Goals

1. Ship one working vertical slice of the full mentee→mentor meeting lifecycle (request through feedback) end to end, not partial pieces of many features.
2. Every meeting's state is always one of a fixed, enumerated set, and every transition between states is enforced by one shared function — no ad hoc status writes from routes.
3. Reminders and post-meeting nudges fire automatically without a message broker or second service.
4. A user holding multiple roles (mentee + mentor + admin) sees and can use every section their roles unlock, in one account, one login.
5. Ship on infrastructure the team can actually run for free for the semester (Render/Railway + Postgres, React on Vercel) — no infra work that doesn't serve a graded requirement.

## Non-Goals

- **No microservices, no message broker, no multiple databases.** The original 3-service/3-DB draft is explicitly replaced by this spec; do not partially reintroduce it.
- **No standing/public mentor calendar.** Availability is marked per request (request-first, above), not published open ahead of time.
- **No real-time chat between mentor and mentee.** Coordination happens through the request → offer-times → pick flow only, not free-form messaging.
- **No multi-select.** A mentee picks **exactly one** offered time to confirm a meeting — not several candidate slots at once.
- **No payment or credentialing/verification of mentors.** Mentor status is self-declared via `roles`.
- **No mobile app.** Web only (responsive is fine, but no native build).
- **WhatsApp delivery is not required for v1.** The notification abstraction ships with console/email; WhatsApp is an additive provider swapped in later with zero changes to calling code.

## User Stories

*(Requirement numbers match the PDF exactly.)*

- As a **mentee**, I want to browse mentor profiles so that I can find someone relevant to my goals. (R3)
- As a **mentor**, I want to create and edit my mentoring profile at any time so that mentees see accurate details about what I offer. (R4.1)
- As a **mentee**, I want to express interest in meeting a specific mentor with one click so that I can start a request without friction. (R4.2)
- As a **mentor**, I want to be notified when someone wants to meet me and then mark the times I'm free in a calendar-like UI — or reject the request if I can't at all — so that I stay in control of my time. (R4.3)
- As a **mentee**, I want to be told whether the mentor rejected me (so I can start over with someone else) or offered times (so I can pick one) so that I always know where my request stands. (R4.4)
- As a **mentor**, I want to be notified once the mentee has picked a time so that I know the meeting is set. (R4.5)
- As a **mentee**, I want to ask the mentor for additional times **once** if none of the offered times work, and otherwise reject, so that a bad first set of times doesn't dead-end the match. (R4.6)
- As either **mentee or mentor**, I want to flag that I can't make a scheduled meeting and get **one** re-coordination attempt so that a single conflict doesn't kill the match. (R5)
- As a **mentee or mentor**, I want a reminder before the meeting and a prompt to confirm arrival so that no-shows are visible. (R6)
- As a **mentee or mentor**, I want to report whether the meeting actually happened, and if not, be asked whether to try again once, so that stalled matches get resolved instead of silently rotting. (R7)
- As a **mentee or mentor**, I want to be nudged if I haven't submitted feedback so that feedback actually gets collected. (R8)
- As a **mentor**, I want an automatic thank-you after a completed meeting so that the platform acknowledges my time. (R9)
- As an **admin**, I want a report of meetings filterable by status and participant so that I can see where things stand. (R10)
- As an **admin**, I want a calendar view of meetings so that I can see load and timing at a glance. (R11)
- As an **admin**, I want to open a single meeting's detail so that I can investigate a specific case. (R12)
- As an **admin**, I want a list of all users so that I can see who's on the platform. (R13)
- As an **admin**, I want a user detail view showing mentoring counts so that I can see who's overloaded or inactive. (R14)
- As an **admin**, I want automatic alerts for not-completed meetings, stalled pre-arrival meetings, overdue feedback, and overloaded mentors so that I don't have to manually audit the whole meeting table. (R15)
- As a **user with multiple roles**, I want to see mentee, mentor, and admin sections in the same account based on my `roles`, so that I'm not forced into one exclusive dashboard.

## Functional Requirements

| # | Requirement |
|---|---|
| 3 | Mentee can browse a list of mentors (`GET /api/users/mentors`) and view a mentor's detail page. |
| 4.1 | Mentor can create/edit their `mentor_profiles` row at any time (background, `advice_topics`, `max_meetings`, `meeting_length_minutes`, `is_active`). |
| 4.2 | Mentee clicks "request a meeting" on a chosen mentor → a `meetings` row is created in `pending_mentor_times`; the mentor is notified (R4.3). |
| 4.3 | The notified mentor either **marks the times she's free** for this request in a calendar-like UI (`availability_blocks` rows tied to the meeting) → meeting moves to `pending_mentee_selection`; **or rejects** the request → `rejected`. |
| 4.4 | If rejected, the mentee is notified and starts over with a different mentor. If times were offered, the mentee sees them and picks **exactly one** → meeting moves to `scheduled`, `scheduled_time` set to that block's `start_time`, the block's `is_booked = true`. |
| 4.5 | On the mentee's pick, the mentor is notified the match is made — via the notification abstraction. |
| 4.6 | If none of the offered times work, the mentee may request additional times **once** (guarded by `more_times_used`): meeting returns to `pending_mentor_times`, the mentor adds times, flow repeats from 4.3. If `more_times_used` is already true, she cannot ask again and must reject (→ `rejected`). |
| 5 | After a meeting is `scheduled`, either party may report they can't make it. Allowed **once** (guarded by `reschedule_used`): the booked block is released and the meeting returns to `pending_mentor_times` so the mentor re-marks times; the other party is notified. A second such report on the same meeting → `cancelled`. |
| 6 | 2 days before `scheduled_time`, a reminder is sent to both parties and each is asked to confirm arrival. When both confirm (`mentee_arrival_confirmed` and `mentor_arrival_confirmed` both true) → `arrival_confirmed`. |
| 7 | After `scheduled_time` passes (from `arrival_confirmed`), the system checks whether the meeting happened. If yes → `completed`, feedback requested from both. If no → `not_completed`, both parties are asked "still want to meet?" — if both say yes, one re-coordination is allowed (guarded by `retry_after_noshow_used`, returns to `pending_mentor_times`); otherwise the meeting stays `not_completed`. |
| 8 | If a user hasn't submitted feedback, they are reminded every 2 days, repeating indefinitely until that user's feedback is submitted. |
| 9 | After a meeting reaches `completed`, the mentor automatically receives a thank-you notification. |
| 10 | Admin can view/filter a meetings report by `status` and by participant (mentee or mentor). Statuses shown map 1:1 to the meeting status enum (and to the PDF's R10 status list). |
| 11 | Admin can view meetings on a calendar, color-coded by `StatusBadge`/status. |
| 12 | Admin can open a single meeting detail view (`/meetings/:id`) showing full history/state and any feedback. |
| 13 | Admin can view a list of all users. |
| 14 | Admin can open a user detail view (`/admin/users/:id`) showing that user's mentoring/mentee meeting counts. |
| 15 | Scheduled scan (cron) raises admin alerts for: meetings in `not_completed`; meetings below `arrival_confirmed` whose `scheduled_time` has already passed; meetings with feedback outstanding for more than 1 week; mentors with more than 10 completed mentoring meetings. |

## The Meeting State Machine

States: `pending_mentor_times` · `pending_mentee_selection` · `scheduled` · `arrival_confirmed` · `completed` · `not_completed` · `feedback_submitted` · `rejected` · `cancelled`.

- `pending_mentor_times` — the request exists; the mentor needs to mark the times she's free (or reject). (PDF: *"waiting for mentor to mark times in the calendar."*)
- `pending_mentee_selection` — the mentor has offered ≥1 time block; the mentee needs to pick one (or ask for more / reject). (PDF: *"waiting for mentee to select a time."*)

Transitions (implemented as `canTransition(from, to)` + `applyTransition(meeting, event)` — pure functions, the single source of truth for every status change in the app; no route or job may write `meetings.status` directly):

- `— → pending_mentor_times`: mentee clicks "request a meeting" against a mentor (R4.2).
- `pending_mentor_times → pending_mentee_selection`: mentor marks ≥1 available block for this request (R4.3).
- `pending_mentor_times → rejected`: mentor rejects the request (R4.3/4.4).
- `pending_mentee_selection → scheduled`: mentee picks exactly one offered block (R4.4) → `scheduled_time` set, block's `is_booked = true` → notify mentor (R4.5).
- `pending_mentee_selection → pending_mentor_times`: mentee requests more times (R4.6) — **guarded**: only if `more_times_used == false`; sets it true. Mentor then adds times and the flow repeats.
- `pending_mentee_selection → rejected`: mentee can't do any offered time **and `more_times_used == true` already** — forced reject, no further "more times" loop (R4.6).
- `scheduled → pending_mentor_times`: either party reports they can't make it (R5) — **guarded**: only if `reschedule_used == false`; sets it true, releases the booked block.
- `scheduled → cancelled`: a second can't-make-it report (`reschedule_used == true` already) — terminal (R5).
- `scheduled → arrival_confirmed`: both `mentee_arrival_confirmed` and `mentor_arrival_confirmed` are true (R6).
- `arrival_confirmed → completed`: meeting confirmed as happened (R7) → feedback requested.
- `arrival_confirmed → not_completed`: meeting confirmed as not happened (R7).
- `not_completed → pending_mentor_times`: both parties say "still want to meet?" (R7) — **guarded**: only if `retry_after_noshow_used == false`; sets it true.
- `not_completed → not_completed`: guard fails (already retried once) or not both "yes" — terminal for this pair.
- `completed → feedback_submitted`: feedback received from both parties.

**Re-coordination limits are per situation, not one shared counter.** Three independent boolean guards live on the meeting — `more_times_used` (R4.6), `reschedule_used` (R5), `retry_after_noshow_used` (R7) — each granting exactly one use. Using the R4.6 retry does **not** consume the R5 or R7 retry, matching the PDF's per-stage "only one iteration" wording. Each flag defaults `false`; the first qualifying transition sets it `true`; once `true`, that specific trigger can never fire again for that meeting.

This is the highest-priority unit-test target in the codebase: every arrow above, plus each guard boundary (flag `false` succeeds, flag `true` rejects/terminates), needs a test.

## Data Model (PostgreSQL — one database, no exceptions)

- **users**: `id uuid pk`, `email unique`, `password_hash`, `username`, `roles text[]` (subset of `mentee`/`mentor`/`admin`), `full_name`, `photo_url`, `github_url`, `linkedin_url`, `job`, `workplace`, `years_experience`, `tech_stack text[]`, `created_at`.
- **mentor_profiles**: `user_id fk → users`, `background`, `advice_topics jsonb`, `max_meetings`, `meeting_length_minutes`, `is_active`.
- **availability_blocks**: `id pk`, `mentor_id fk → users`, `meeting_id fk → meetings` (**not null** — a block is always marked in response to a specific request; request-first, R4.3), `start_time`, `end_time`, `is_booked bool` (true only once the mentee picks it and the meeting reaches `scheduled`). When a meeting is rescheduled (R5) or the mentee asks for more times (R4.6), the mentor adds new blocks for the same `meeting_id`.
- **meetings**: `id pk`, `mentee_id fk → users`, `mentor_id fk → users`, `status` (enum, see above), `scheduled_time` nullable, `more_times_used bool default false`, `reschedule_used bool default false`, `retry_after_noshow_used bool default false`, `mentee_arrival_confirmed bool default false`, `mentor_arrival_confirmed bool default false`, `created_at`, `updated_at`.
- **feedbacks**: `id pk`, `meeting_id fk → meetings`, `submitted_by fk → users`, `rating`, `open_text`, `created_at`.
- **notification_logs**: `id pk`, `recipient_id fk → users`, `meeting_id fk → meetings`, `type`, `channel`, `status`, `sent_at`.

`roles` is always `text[]`; a user with `['mentee','mentor','admin']` is valid and sees every section their roles grant. Optional/flexible fields (e.g. `advice_topics`) live in `jsonb`/array columns on these six tables — no second data store, ever.

## API Contract

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account (strong-password validation enforced). |
| POST | `/api/auth/login` | Authenticate, return JWT. |
| GET/PUT | `/api/users/profile` | Read/update own profile. |
| GET | `/api/users/mentors` | Browse mentors (R3). |
| POST | `/api/mentor/profile` | Create/edit mentor profile (R4.1). |
| POST | `/api/meetings/request` | Mentee requests a meeting with a mentor → `pending_mentor_times`; notifies mentor (R4.2). |
| GET | `/api/meetings/:id` | Meeting detail incl. offered blocks and feedback (mentee/mentor/admin; R12). |
| PUT | `/api/meetings/:id/offer-times` | Mentor marks available blocks for this request → `pending_mentee_selection` (R4.3). |
| PUT | `/api/meetings/:id/reject` | Mentor rejects the request → `rejected` (R4.3/4.4). |
| PUT | `/api/meetings/:id/select-time` | Mentee picks **exactly one** offered block → `scheduled`; notifies mentor (R4.4/4.5). Rejected if more than one block is submitted. |
| PUT | `/api/meetings/:id/request-more-times` | Mentee asks for additional times (once, `more_times_used` guard) → `pending_mentor_times` (R4.6). |
| PUT | `/api/meetings/:id/status` | Drives the remaining transitions: can't-make-it (R5), arrival confirmation (R6), happened/didn't-happen + "try again" (R7). Every call routes through `applyTransition` — never a raw status write. |
| POST | `/api/feedback` | Submit feedback for a meeting (R7 → `feedback_submitted`). |
| GET | `/api/reports/meetings` | Admin meetings report, filterable by status/participant (R10). |
| GET | `/api/reports/users` | Admin users list + per-user detail data (R13/14). |

All routes except `/api/auth/*` and `/api/users/mentors` require a valid JWT (`auth.middleware` → `req.user = { id, roles }`); admin-only routes are additionally gated by `rbac.middleware`.

## Acceptance Criteria

- [ ] A user can hold `roles = ['mentee','mentor','admin']` simultaneously and see mentee, mentor, and admin navigation sections in the same session — no exclusive-dashboard redirect.
- [ ] A mentee clicking "request a meeting" creates a meeting in `pending_mentor_times` and the mentor receives a notification.
- [ ] From `pending_mentor_times`, the mentor can either offer ≥1 time block (→ `pending_mentee_selection`) or reject (→ `rejected`, mentee notified).
- [ ] A mentee submitting more than one block to `/select-time` is rejected by the API; submitting exactly one → `scheduled`, `scheduled_time` set, that block `is_booked = true`, mentor notified.
- [ ] Given `more_times_used == false`, when the mentee requests more times, the meeting returns to `pending_mentor_times` and `more_times_used` becomes true; given `more_times_used == true`, a further request is refused and the only remaining action is reject.
- [ ] Given a `scheduled` meeting with `reschedule_used == false`, when either party reports can't-make-it, the booked block is released, the meeting returns to `pending_mentor_times`, the other party is notified, and `reschedule_used` becomes true; a second can't-make-it → `cancelled`.
- [ ] The three re-coordination guards are **independent**: consuming `more_times_used` does not block a later R5 reschedule or an R7 retry (each has its own flag).
- [ ] Given a `scheduled` meeting where both `mentee_arrival_confirmed` and `mentor_arrival_confirmed` become true, the status becomes `arrival_confirmed`.
- [ ] Given an `arrival_confirmed` meeting confirmed as happened → `completed` and both parties receive a feedback request; confirmed as not happened → `not_completed`, and if both choose "try again" (with `retry_after_noshow_used == false`) it returns to `pending_mentor_times`.
- [ ] Given `NOTIFICATION_PROVIDER=console`, every notification event (request received, times offered, rejected, match made, reminder, arrival check, thank-you, feedback nudge) writes a row to `notification_logs` and prints to console — no code changes needed to later switch to `EmailProvider` or `WhatsAppProvider`.
- [ ] With `NOTIFICATION_PROVIDER=console` and a feedback request left unsubmitted, a reminder fires every 2 days indefinitely (verified by shortening the cron interval) until that user's feedback is recorded — then it stops.
- [ ] Admin's `/admin` report can filter meetings by status and by participant, and every value in the status enum appears correctly labeled via `StatusBadge`.
- [ ] Admin alerts surface all four R15 conditions: `not_completed` meetings; pre-`arrival_confirmed` meetings past their `scheduled_time`; feedback outstanding > 1 week; mentors with > 10 completed meetings.
- [ ] `npm run install-all && npm run dev` brings up client on :3000 and server on :5000 using the existing root scripts, unmodified.
- [ ] State-machine unit tests cover every transition in the table above plus each guard's boundary (flag `false` succeeds, flag `true` rejects/terminates), and pass under `npm test`.

## Out of Scope

- Real-time messaging/chat between mentor and mentee.
- A standing/public mentor calendar (availability is request-first).
- Mentor verification, credentialing, or ranking beyond self-reported profile fields.
- Payments, subscriptions, or any monetary flow.
- Native mobile apps.
- A message broker, multiple databases, or any service split beyond the three internal Express modules (`identity`, `scheduling`, `comms`).
- WhatsApp delivery for v1 — the notification abstraction must support adding it later without touching `scheduling` or `identity` code, but shipping it is not required to consider this spec complete.

## Open Risks

- **Deployment split:** the backend's `node-cron` jobs need a persistent process — Vercel serverless cannot run them reliably. Backend + Postgres go on Render or Railway (free tier); only the React frontend goes on Vercel. This is a deliberate deviation from the course spec's Vercel-only suggestion and should be called out explicitly in submission notes.
- **Test coverage baseline:** prior instructor feedback noted only one team member wrote tests. Minimum bar for this spec: Jest + supertest smoke test per module (identity, scheduling, comms), plus full coverage of the state machine's transition table and all three guard flags.
- **ORM choice (Prisma vs. Knex/pg):** Prisma is the default for migration speed and typed models given the limited token budget; Knex/`pg` remains an acceptable substitute only if the team wants raw-SQL practice as an explicit learning goal — pick one before Foundations work starts, don't mix.
- **`.env.example` must exist before any module work starts:** `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NOTIFICATION_PROVIDER`, plus optional `EMAIL_*`/`TWILIO_*`. Missing today — first Foundations task.
