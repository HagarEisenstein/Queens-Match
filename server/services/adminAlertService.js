const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WAITING_MENTOR_MS = 72 * 60 * 60 * 1000;

function createAdminAlertService({ prisma, notificationService = null, now = () => new Date() }) {
  async function createAlert({ alertType, idempotencyKey, meetingId = null, subjectUserId = null, payload = {} }) {
    return prisma.adminAlert.upsert({
      where: { idempotencyKey },
      create: { idempotencyKey, alertType, meetingId, subjectUserId, payload },
      update: {},
    });
  }

  async function notifyMenteeOfInactivity(user, warningAt) {
    if (!notificationService) return;
    await notificationService.send({
      recipientId: user.id,
      type: "account_inactivity_warning",
      title: "Please log in to keep your account",
      message: "Your Queens Match account has been inactive for one year. Log in within one week to keep it active.",
      actionUrl: "/profile",
      emailEligible: false,
      deduplicationKey: `account_inactivity_warning:${user.id}:${warningAt.toISOString().slice(0, 10)}`,
    });
  }

  async function scan({ at = now() } = {}) {
    const cutoff72h = new Date(at.getTime() - WAITING_MENTOR_MS);
    const oneYearAgo = new Date(at.getTime() - ONE_YEAR_MS);
    const alerts = [];
    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { status: "cancelled" },
          { status: "pending_mentor_times", createdAt: { lt: cutoff72h } },
          { status: "not_completed" },
          { status: { in: ["pending_mentor_times", "pending_mentee_selection", "scheduled"] }, scheduledTime: { lt: at } },
        ],
      },
      select: { id: true, status: true, createdAt: true, scheduledTime: true, menteeId: true, mentorId: true },
    });
    for (const meeting of meetings) {
      const type = meeting.status === "cancelled"
        ? "cancelled_meeting"
        : meeting.status === "pending_mentor_times" && at.getTime() - new Date(meeting.createdAt).getTime() > WAITING_MENTOR_MS
          ? "mentor_response_overdue"
          : meeting.status === "not_completed" ? "meeting_not_completed" : "stalled_pre_arrival";
      alerts.push(await createAlert({
        alertType: type,
        idempotencyKey: `${type}:${meeting.id}`,
        meetingId: meeting.id,
        payload: { status: meeting.status, scheduledTime: meeting.scheduledTime },
      }));
    }

    const mentees = await prisma.user.findMany({
      where: { roles: { has: "mentee" }, lastActivityAt: { lt: oneYearAgo }, deletionScheduledAt: null },
      select: { id: true, lastActivityAt: true },
    });
    for (const mentee of mentees) {
      const warningAt = new Date(at);
      const alert = await createAlert({
        alertType: "account_inactivity_warning",
        idempotencyKey: `account_inactivity_warning:${mentee.id}:${new Date(mentee.lastActivityAt).toISOString().slice(0, 10)}`,
        subjectUserId: mentee.id,
        payload: { inactiveSince: mentee.lastActivityAt, deletionScheduledFor: new Date(at.getTime() + ONE_WEEK_MS) },
      });
      await prisma.user.update({ where: { id: mentee.id }, data: { deletionWarningSentAt: warningAt, deletionScheduledAt: new Date(at.getTime() + ONE_WEEK_MS) } });
      await notifyMenteeOfInactivity(mentee, warningAt);
      alerts.push(alert);
    }
    return alerts;
  }

  async function list({ status } = {}) {
    return prisma.adminAlert.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" } });
  }

  async function review(idempotencyKey, reviewerId, { status, note = null }) {
    if (!["approved", "resolved"].includes(status)) {
      const error = new Error("Alert review status must be approved or resolved.");
      error.statusCode = 400;
      error.code = "INVALID_ALERT_REVIEW";
      throw error;
    }
    return prisma.adminAlert.update({ where: { idempotencyKey }, data: { status, reviewedBy: reviewerId, reviewNote: note, reviewedAt: now() } });
  }

  async function recordActivity(userId) {
    return prisma.user.update({ where: { id: userId }, data: { lastActivityAt: now(), deletionWarningSentAt: null, deletionScheduledAt: null } });
  }

  return { scan, list, review, recordActivity, createAlert };
}

module.exports = { createAdminAlertService, ONE_YEAR_MS, ONE_WEEK_MS, WAITING_MENTOR_MS };
