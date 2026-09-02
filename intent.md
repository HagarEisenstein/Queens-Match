# Queens Match — Intent

## Problem

Matching mentors and mentees in the QueenB community today is manual and ad hoc: there's no shared system for a mentee to find a mentor, propose a meeting, land on a time both sides can make, confirm it happened, and collect feedback afterward. Nobody has visibility into whether meetings are actually happening or stalling.

## What we're building

A single web app — **Queens Match** — that runs one workflow end to end:

**mentee requests a meeting with a mentor → the mentor is notified and marks the times she's free (or rejects) → mentee picks one of the offered times → meeting is confirmed → it happens → both sides give feedback (nudged every 2 days until they do)**

with automatic WhatsApp/email reminders along the way, and an admin dashboard that shows which meetings are healthy and which ones need a nudge. Availability is **request-first** — a mentor marks times in response to a specific mentee's interest, not on a standing public calendar — matching how the community spec describes the flow.

## Who it's for

- **Mentees and mentors** in the QueenB community — the people actually using the matching flow.
- **Admins** who need oversight without manually chasing every pair.
- **The 3-person dev team** (a course group project, QueenB Aug 2026 spec) building it under a real deadline and a limited budget.

## Why this shape

The team's first draft was a microservices architecture — three services, three databases, a message broker, an API gateway. That's the wrong shape for this project: the domain is one tightly-coupled state machine (a meeting moves through a fixed set of stages with strict rules), the instructor's own feedback said the gap to close is basic structure and middleware, not distributed systems, and the suggested deployment target (Vercel) can't even run that many moving parts.

So we're building it as **one application with clear internal boundaries** instead of several small ones with expensive plumbing between them: one backend, one database, three well-separated modules mapped to the three people building it. Every dev still owns a complete slice — frontend, backend, and data — for their part of the product; they just aren't paying an infrastructure tax to do it. Real-world channels (WhatsApp) are treated as swappable — the app works correctly with console or email notifications on day one, and WhatsApp itself slots in later without touching any other code.

The technical detail — architecture, data model, and requirement-by-requirement behavior — is in [spec.md](spec.md).
