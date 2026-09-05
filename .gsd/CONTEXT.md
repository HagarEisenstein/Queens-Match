# Queens Match — Durable Context

- Current branch: `ori`; preserve existing user changes.
- Architecture: Express modular monolith, PostgreSQL via Prisma, React + MUI, JWT roles as `text[]`.
- Coordination is request-first: mentee request → mentor offers/rejects → mentee selects exactly one slot.
- The three retry guards are independent booleans: `more_times_used`, `reschedule_used`, `retry_after_noshow_used`.
- Server-side authorization is mandatory; multi-role users must retain all capabilities.
- Meeting status is the canonical lifecycle enum from `spec.md`; admin completion means both participants submitted `happened=true`.
- No destructive git operations or commits/pushes unless explicitly requested.
- Existing untracked `queens_match_ui_spec.docx` and modified `.gitignore` are user-owned and must be preserved.
