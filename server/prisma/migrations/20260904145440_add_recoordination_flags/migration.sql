-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "more_times_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reschedule_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retry_after_noshow_used" BOOLEAN NOT NULL DEFAULT false;
