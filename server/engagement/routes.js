const express = require("express");
const { body, param } = require("express-validator");
const { validate } = require("../commons/validation.middleware");
const { requireAnyRole } = require("../middleware/auth");

function createEngagementRouter({
  authenticate,
  outcomeService,
  feedbackService,
  blocklistService,
  authorizeAdmin = requireAnyRole("admin"),
}) {
  const router = express.Router();

  router.put(
    "/meetings/:id/arrival",
    authenticate,
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const result = await outcomeService.recordArrival(req.params.id, req.user);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/meetings/:id/outcome",
    authenticate,
    [
      param("id").isUUID(),
      body("happened").isBoolean().toBoolean(),
      body("absentParty")
        .optional({ nullable: true })
        .isIn(["self", "other", "both", "unclear"]),
      body("stillWantToMeet").optional({ nullable: true }).isBoolean().toBoolean(),
      validate,
    ],
    async (req, res, next) => {
      try {
        const result = await outcomeService.submitOutcome(req.params.id, req.user, {
          happened: req.body.happened,
          absentParty: req.body.absentParty,
          stillWantToMeet: req.body.stillWantToMeet,
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/meetings/:id/outcomes",
    authenticate,
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const result = await outcomeService.getOutcomes(req.params.id, req.user);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/meetings/:id/feedback",
    authenticate,
    [
      param("id").isUUID(),
      body("rating").isInt({ min: 1, max: 5 }).toInt(),
      body("openText").optional({ nullable: true }).isString().isLength({ max: 5000 }),
      validate,
    ],
    async (req, res, next) => {
      try {
        const feedback = await feedbackService.submitFeedback(req.params.id, req.user, {
          rating: req.body.rating,
          openText: req.body.openText,
        });
        res.status(201).json(feedback);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/meetings/:id/feedback",
    authenticate,
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const feedback = await feedbackService.listFeedback(req.params.id, req.user);
        res.json(feedback);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/blocks",
    authenticate,
    authorizeAdmin,
    async (req, res, next) => {
      try {
        const blocks = await blocklistService.listActive({
          menteeId: req.query.menteeId,
          mentorId: req.query.mentorId,
        });
        res.json(blocks);
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/blocks/:id",
    authenticate,
    authorizeAdmin,
    [param("id").isUUID(), validate],
    async (req, res, next) => {
      try {
        const cleared = await blocklistService.clearBlock(req.params.id);
        res.json(cleared);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = { createEngagementRouter };
