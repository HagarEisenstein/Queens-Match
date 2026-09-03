-- Prevent concurrent requests from creating multiple active meetings
-- for the same mentee/mentor pair. Rejected meetings may be recreated.
CREATE UNIQUE INDEX "meetings_one_active_per_pair_idx"
ON "meetings" ("mentee_id", "mentor_id")
WHERE "status" IN (
    'pending_mentor_times',
    'pending_mentee_selection',
    'scheduled'
);
