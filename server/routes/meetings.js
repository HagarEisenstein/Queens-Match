const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../commons/validation.middleware");
const {
  requestMeeting,
  offerTimes,
  rejectMeeting,
  selectTime,
  getMeetingById,
  listMeetingsForUser,
} = require("../modules/scheduling/schedulingService");

const requestValidation = [
  body("mentorId").isUUID().withMessage("mentorId must be a valid id"),
  validate,
];

const offerTimesValidation = [
  body("slots").isArray({ min: 1 }).withMessage("Offer at least one time slot"),
  body("slots.*.startTime").isISO8601().withMessage("startTime must be an ISO date"),
  body("slots.*.endTime").isISO8601().withMessage("endTime must be an ISO date"),
  validate,
];

const selectTimeValidation = [
  body("slotId").isUUID().withMessage("slotId must be a valid id"),
  validate,
];

function createMeetingsRouter({ authenticate }) {
  const router = express.Router();

  // Everything under /api/meetings requires a logged-in user.
  router.use(authenticate);

  // Mentee expresses interest [R4.2].
  router.post("/", requestValidation, async (req, res, next) => {
    try {
      const meeting = await requestMeeting({
        menteeId: req.user.id,
        mentorId: req.body.mentorId,
      });
      res.status(201).json(meeting);
    } catch (error) {
      next(error);
    }
  });

  // Every meeting the caller is part of, on either side.
  router.get("/", async (req, res, next) => {
    try {
      res.json(await listMeetingsForUser(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      res.json(await getMeetingById(req.params.id, req.user.id));
    } catch (error) {
      next(error);
    }
  });

  // Mentor offers times [R4.3].
  router.post("/:id/offer-times", offerTimesValidation, async (req, res, next) => {
    try {
      const meeting = await offerTimes({
        meetingId: req.params.id,
        actorId: req.user.id,
        slots: req.body.slots,
      });
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  });

  // Mentor rejects the request [R4.3].
  router.post("/:id/reject", async (req, res, next) => {
    try {
      const meeting = await rejectMeeting({
        meetingId: req.params.id,
        actorId: req.user.id,
      });
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  });

  // Mentee picks exactly one offered time [R4.4].
  router.post("/:id/select-time", selectTimeValidation, async (req, res, next) => {
    try {
      const meeting = await selectTime({
        meetingId: req.params.id,
        actorId: req.user.id,
        slotId: req.body.slotId,
      });
      res.json(meeting);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createMeetingsRouter;
