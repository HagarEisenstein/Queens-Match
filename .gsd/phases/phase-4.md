# Phase 4 — Persistent Admin Alerts and Exception Handling

## Decisions

- Use a dedicated `AdminAlert` Prisma model with `idempotency_key` as the primary key.
- Keep alert review state in-app and admin-only; do not create admin email deliveries for exception records.
- Use `last_activity_at` as the account activity clock. A one-year inactive mentee receives one warning and gets a deletion date seven days later; login clears the warning/schedule.
- Keep scans in the existing in-process `node-cron` job runner and make each alert upsert idempotently.

## Implementation

- Added `AdminAlert`, activity, warning, and deletion-schedule fields plus migration `20260905110000_admin_alerts_and_activity`.
- Added `server/services/adminAlertService.js` for exception scanning, idempotent upserts, inactivity notifications, listing, review, and activity reset.
- Wired the scan into `startNotificationJobs` and `bootstrapNotifications`.
- Added admin persistent-alert listing/review endpoints and dashboard rendering with explicit Approve action.
- Added three focused service tests for idempotency, inactivity scheduling, and review validation.
- Documented alert/review/inactivity behavior in README.

## Verification

- Server: 13 Jest suites / 119 tests passed.
- Comms: 13 tests passed.
- Client: 14 suites / 39 tests passed.
- Prisma schema validation passed; previous production build passed; `git diff --check` passed.

## Remaining Risks

- Account deletion itself is intentionally not destructive; the scan schedules it using `deletion_scheduled_at` for a later deletion worker.
- Existing legacy derived alert arrays remain for compatibility; the persistent `AdminAlert` records are the canonical exception feed for new scans.
