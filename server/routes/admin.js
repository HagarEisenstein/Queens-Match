const express = require("express");
const { query, param, validationResult } = require("express-validator");
const { AppError } = require("../middleware/errors");
const prisma = require("../commons/db");
const { normalizeEmail } = require("../modules/identity/validation");

// The only statuses the real state machine (server/modules/scheduling/meetingStateMachine.js)
// ever assigns to Meeting.status. There is no "completed" / "arrival_confirmed" /
// "feedback_submitted" status — those concepts are tracked as separate rows (see below),
// not as values of this column.
const MEETING_STATUSES = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "arrival_confirmed",
  "completed",
  "not_completed",
  "feedback_submitted",
  "admin_review",
  "rejected",
  "cancelled",
];

const OVERDUE_FEEDBACK_DAYS = 7;
const OVERLOADED_MENTOR_THRESHOLD = 10;

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(
      new AppError(400, "VALIDATION_ERROR", "Request validation failed.", result.array())
    );
  }
  return next();
}

const userSummarySelect = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  roles: true,
};

/**
 * "Completed" is not a Meeting.status value — it's derived from whether any
 * MeetingOutcomeResponse row exists for the meeting (a participant reported on it
 * at all, regardless of whether `happened` was true or false).
 */
async function completedMeetingIdSet(meetingIds) {
  if (meetingIds.length === 0) return new Set();
  const rows = await prisma.meetingOutcomeResponse.findMany({
    where: { meetingId: { in: meetingIds }, happened: true },
    select: { meetingId: true, happened: true },
  });
  const responses = new Map();
  for (const row of rows) responses.set(row.meetingId, (responses.get(row.meetingId) || 0) + 1);
  return new Set([...responses].filter(([, count]) => count >= 2).map(([id]) => id));
}

function canonicalStatus(meeting, outcomeResponses = [], feedback = []) {
  if (["rejected", "cancelled"].includes(meeting.status)) return meeting.status;
  const mentee = outcomeResponses.find((row) => row.role === "mentee");
  const mentor = outcomeResponses.find((row) => row.role === "mentor");
  if (mentee && mentor) {
    if (mentee.happened !== mentor.happened) return "admin_review";
    if (mentee.happened && mentor.happened) return feedback.length >= 2 ? "feedback_submitted" : "completed";
    return "not_completed";
  }
  return meeting.status;
}

/**
 * @param {object} deps
 * @param {import("express").RequestHandler} deps.authenticate
 * @param {import("express").RequestHandler} deps.authorizeAdmin - the app's existing
 *   admin-role check (requireCurrentRole(userRepository, "admin")). Applied once, at the
 *   router level, so every route below is admin-only by construction.
 * @param {object} deps.adminInviteRepository
 * @param {object} deps.userRepository
 */
function createAdminRouter({
  authenticate,
  authorizeAdmin,
  alertService = null,
  userRepository,
  notificationService,
  notificationRepository,
}) {
  if (!authenticate || !authorizeAdmin) {
    throw new Error("createAdminRouter requires both authenticate and authorizeAdmin.");
  }

  const router = express.Router();

  // Zero Trust: nothing under this router is reachable without a valid token AND
  // the admin role, checked before any handler below runs.
  router.use(authenticate, authorizeAdmin);

  router.post("/invites", async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      if (!email) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "A valid email is required."
        );
      }

      const existingUser = await userRepository.findPublicByEmail(email);
      if (!existingUser) {
        throw new AppError(
          404,
          "USER_NOT_FOUND",
          "No user found with this email. The user must register first."
        );
      }
      if (existingUser.roles?.includes("admin")) {
        throw new AppError(
          409,
          "ADMIN_EXISTS",
          "That email already belongs to an admin."
        );
      }

      const existingPendingInvite =
        await notificationRepository.findPendingAdminInvite?.(
          req.user.id,
          existingUser.id
        );
      if (existingPendingInvite) {
        return res.status(201).json({
          invite: {
            id: existingPendingInvite.id,
            email: existingUser.email,
            status: existingPendingInvite.status || "pending",
            recipient: {
              id: existingUser.id,
              email: existingUser.email,
              username: existingUser.username,
              roles: existingUser.roles,
            },
            created_at: existingPendingInvite.createdAt,
          },
        });
      }

      const notification = await notificationService.send({
        recipientId: existingUser.id,
        type: "ADMIN_INVITE",
        status: "pending",
        title: "Admin invitation",
        message: "An admin invited you to become an admin in Queens Match.",
        actionUrl: null,
        metadata: {
          invitedBy: req.user.id,
          invitedEmail: existingUser.email,
        },
        popupEligible: true,
        emailEligible: false,
        deduplicationKey: `admin_invite:${req.user.id}:${existingUser.id}:${Date.now()}`,
      });

      res.status(201).json({
        invite: {
          id: notification.id,
          email: existingUser.email,
          status: notification.status,
          recipient: {
            id: existingUser.id,
            email: existingUser.email,
            username: existingUser.username,
            roles: existingUser.roles,
          },
          created_at: notification.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/invites", async (req, res, next) => {
    try {
      const notifications = await notificationRepository.listAdminInvitesByInviter(req.user.id);
      res.json({
        invites: notifications.map((notification) => ({
          id: notification.id,
          email: notification.recipient?.email || notification.metadata?.invitedEmail || null,
          status: notification.status || "pending",
          created_at: notification.createdAt,
          acted_at: notification.actionCompletedAt,
          recipient: notification.recipient
            ? {
                id: notification.recipient.id,
                email: notification.recipient.email,
                username: notification.recipient.username,
                full_name: notification.recipient.fullName,
                roles: notification.recipient.roles,
              }
            : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/alerts/persistent", async (req, res, next) => {
    try { res.json({ alerts: alertService ? await alertService.list({ status: req.query.status }) : [] }); } catch (error) { next(error); }
  });
  router.put("/alerts/:id/review", async (req, res, next) => {
    try {
      if (!alertService) throw new AppError(503, "ALERTS_UNAVAILABLE", "Alert service is unavailable.");
      res.json(await alertService.review(req.params.id, req.user.id, { status: req.body.status, note: req.body.note }));
    } catch (error) { next(error); }
  });

  // R10 — status report, filterable by status and by participant.
  router.get(
    "/meetings",
    [
      query("status").optional().isIn(MEETING_STATUSES),
      query("participantId").optional().isUUID(),
      validate,
    ],
    async (req, res, next) => {
      try {
        const { status, participantId } = req.query;
        const where = {};
        if (status) where.status = status;
        if (participantId) {
          where.OR = [{ menteeId: participantId }, { mentorId: participantId }];
        }

        let meetings = await prisma.meeting.findMany({
          where,
          include: {
            mentee: { select: userSummarySelect },
            mentor: { select: userSummarySelect },
            timeSlots: { orderBy: { startTime: "asc" } },
          },
          orderBy: [{ scheduledTime: "asc" }, { createdAt: "desc" }],
        });

        const outcomeRows = meetings.length ? await prisma.meetingOutcomeResponse.findMany({ where: { meetingId: { in: meetings.map((m) => m.id) } } }) : [];
        const feedbackRows = meetings.length ? await prisma.feedback.findMany({ where: { meetingId: { in: meetings.map((m) => m.id) } } }) : [];
        const outcomeByMeeting = new Map();
        const feedbackByMeeting = new Map();
        for (const row of outcomeRows) outcomeByMeeting.set(row.meetingId, [...(outcomeByMeeting.get(row.meetingId) || []), row]);
        for (const row of feedbackRows) feedbackByMeeting.set(row.meetingId, [...(feedbackByMeeting.get(row.meetingId) || []), row]);
        if (status) meetings = meetings.filter((meeting) => canonicalStatus(meeting, outcomeByMeeting.get(meeting.id) || [], feedbackByMeeting.get(meeting.id) || []) === status);
        const completed = await completedMeetingIdSet(meetings.map((m) => m.id));
        res.json({
          meetings: meetings.map((meeting) => ({
            ...meeting,
            isCompleted: completed.has(meeting.id),
            canonicalStatus: canonicalStatus(meeting, outcomeByMeeting.get(meeting.id) || [], feedbackByMeeting.get(meeting.id) || []),
          })),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // R12 — single meeting detail, including outcome responses and feedback.
  // MeetingOutcomeResponse, Feedback, and FeedbackRequest hold meetingId as a plain
  // column with no relation back to Meeting in the current schema, so these are
  // fetched with separate queries rather than a Prisma `include`.
  router.get(
    "/meetings/:id",
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const meeting = await prisma.meeting.findUnique({
          where: { id },
          include: {
            mentee: { select: userSummarySelect },
            mentor: { select: userSummarySelect },
            timeSlots: { orderBy: { startTime: "asc" } },
          },
        });
        if (!meeting) {
          throw new AppError(404, "MEETING_NOT_FOUND", "Meeting not found.");
        }

        const [outcomeResponses, feedback, feedbackRequests] = await Promise.all([
          prisma.meetingOutcomeResponse.findMany({
            where: { meetingId: id },
            orderBy: { createdAt: "asc" },
          }),
          prisma.feedback.findMany({
            where: { meetingId: id },
            orderBy: { createdAt: "asc" },
          }),
          prisma.feedbackRequest.findMany({
            where: { meetingId: id },
            orderBy: { feedbackRequestedAt: "asc" },
          }),
        ]);

        res.json({
          meeting: { ...meeting, isCompleted: outcomeResponses.filter((row) => row.happened).length >= 2, canonicalStatus: canonicalStatus(meeting, outcomeResponses, feedback) },
          outcomeResponses,
          feedback,
          feedbackRequests,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // R13 — users list with mentor/mentee meeting counts, via Prisma's relation _count.
  router.get("/users", async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          ...userSummarySelect,
          createdAt: true,
          _count: {
            select: { meetingsAsMentor: true, meetingsAsMentee: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const completedRows = await prisma.meetingOutcomeResponse.findMany({
        where: { happened: true },
        select: { meetingId: true, role: true },
      });
      const byMeeting = new Map();
      for (const row of completedRows) byMeeting.set(row.meetingId, [...(byMeeting.get(row.meetingId) || []), row.role]);
      const completedIds = [...byMeeting].filter(([, roles]) => new Set(roles).size >= 2).map(([id]) => id);
      const completedMeetings = completedIds.length ? await prisma.meeting.findMany({ where: { id: { in: completedIds } }, select: { menteeId: true, mentorId: true } }) : [];
      const counts = new Map();
      for (const meeting of completedMeetings) {
        counts.set(meeting.mentorId, { ...(counts.get(meeting.mentorId) || {}), mentor: (counts.get(meeting.mentorId)?.mentor || 0) + 1 });
        counts.set(meeting.menteeId, { ...(counts.get(meeting.menteeId) || {}), mentee: (counts.get(meeting.menteeId)?.mentee || 0) + 1 });
      }
      res.json({
        users: users.map(({ _count, ...user }) => ({
          ...user,
          mentorMeetingCount: counts.get(user.id)?.mentor || 0,
          menteeMeetingCount: counts.get(user.id)?.mentee || 0,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // R14 — single user detail, with mentor/mentee meeting counts.
  router.get(
    "/users/:id",
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.params.id },
          select: {
            ...userSummarySelect,
            photoUrl: true,
            githubUrl: true,
            linkedinUrl: true,
            job: true,
            workplace: true,
            yearsExperience: true,
            techStack: true,
            createdAt: true,
            _count: {
              select: { meetingsAsMentor: true, meetingsAsMentee: true },
            },
          },
        });
        if (!user) {
          throw new AppError(404, "USER_NOT_FOUND", "User not found.");
        }

        const { _count, ...rest } = user;
        res.json({
          user: {
            ...rest,
            mentorMeetingCount: _count.meetingsAsMentor,
            menteeMeetingCount: _count.meetingsAsMentee,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // R15 — admin alerts, derived only from fields that actually exist today:
  //   - meetings where a participant reported they did not happen
  //     (MeetingOutcomeResponse.happened === false — a real column, distinct from the
  //     existence-based `isCompleted` flag), returned with mentee/mentor/status so the
  //     admin UI can render something useful, not just an id
  //   - a feedback request left unfulfilled for over a week
  //   - a mentor whose meetings have accumulated >10 "completed" meetings, where
  //     "completed" is the same existence-based rule as `isCompleted` (any outcome
  //     response recorded for the meeting, per your Step 2 rule)
  router.get("/alerts", async (req, res, next) => {
    try {
      const now = new Date();
      const overdueThreshold = new Date(now.getTime() - OVERDUE_FEEDBACK_DAYS * 24 * 60 * 60 * 1000);

      const [notHappened, overdueFeedback, allOutcomeMeetingIds] = await Promise.all([
        prisma.meetingOutcomeResponse.findMany({
          where: { happened: false },
          orderBy: { createdAt: "desc" },
        }),
        prisma.feedbackRequest.findMany({
          where: {
            fulfilledAt: null,
            feedbackRequestedAt: { lt: overdueThreshold },
          },
          include: { recipient: { select: userSummarySelect } },
          orderBy: { feedbackRequestedAt: "asc" },
        }),
        prisma.meetingOutcomeResponse.findMany({
          select: { meetingId: true },
        }),
      ]);

      // De-dupe: both participants may each report on the same meeting.
      const notCompletedMeetingIds = [...new Set(notHappened.map((row) => row.meetingId))];
      const completedMeetingIds = [...new Set(allOutcomeMeetingIds.map((row) => row.meetingId))];

      const [notCompletedMeetings, completedMeetings] = await Promise.all([
        notCompletedMeetingIds.length
          ? prisma.meeting.findMany({
              where: { id: { in: notCompletedMeetingIds } },
              select: {
                id: true,
                status: true,
                scheduledTime: true,
                mentee: { select: userSummarySelect },
                mentor: { select: userSummarySelect },
              },
            })
          : [],
        completedMeetingIds.length
          ? prisma.meeting.findMany({
              where: { id: { in: completedMeetingIds } },
              select: { id: true, mentorId: true },
            })
          : [],
      ]);
      const stalledPreArrivalMeetings = await prisma.meeting.findMany({
        where: {
          status: { in: ["pending_mentor_times", "pending_mentee_selection", "scheduled"] },
          scheduledTime: { lt: now },
        },
        select: { id: true, status: true, scheduledTime: true, mentee: { select: userSummarySelect }, mentor: { select: userSummarySelect } },
      });

      const completedCountByMentor = {};
      for (const meeting of completedMeetings) {
        completedCountByMentor[meeting.mentorId] =
          (completedCountByMentor[meeting.mentorId] || 0) + 1;
      }
      const overloadedMentorEntries = Object.entries(completedCountByMentor)
        .filter(([, count]) => count > OVERLOADED_MENTOR_THRESHOLD)
        .map(([mentorId, count]) => ({ mentorId, completedCount: count }));

      const overloadedMentors = overloadedMentorEntries.length
        ? await prisma.user.findMany({
            where: { id: { in: overloadedMentorEntries.map((entry) => entry.mentorId) } },
            select: userSummarySelect,
          })
        : [];

      res.json({
        alerts: {
        meetingsNotCompleted: notCompletedMeetings,
        stalledPreArrivalMeetings,
          overdueFeedback: overdueFeedback.map((request) => ({
            meetingId: request.meetingId,
            recipient: request.recipient,
            feedbackRequestedAt: request.feedbackRequestedAt,
          })),
          overloadedMentors: overloadedMentorEntries.map((entry) => ({
            ...entry,
            mentor: overloadedMentors.find((user) => user.id === entry.mentorId) || null,
          })),
          persistent: alertService ? await alertService.list({ status: "open" }) : [],
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createAdminRouter;
