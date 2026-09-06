const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../commons/validation.middleware");
const {
  getMentors,
  getMentorById,
  getMentorByUserId,
  upsertMentorProfile,
} = require("../services/mentorProfilesService");

const profileValidation = [
  body("background").isString().trim().isLength({ min: 1, max: 5000 }),
  body("adviceTopics").isArray({ min: 1 }),
  // Topics may be built-in choices or a mentor's own free text; both are
  // stored as plain strings, so we only enforce a length sanity cap here.
  body("adviceTopics.*").isString().trim().isLength({ min: 1, max: 100 }),
  body("meetingsOffered").isInt({ min: 1, max: 1000 }).toInt(),
  body("meetingLengthMinutes").isInt({ min: 15, max: 480 }).toInt(),
  validate,
];

function createMentorsRouter({ authenticate }) {
  const router = express.Router();

  // Public discovery endpoints intentionally expose only profile information.
  router.get("/", async (req, res, next) => {
    try {
      res.json(await getMentors());
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticate, async (req, res, next) => {
    try {
      const profile = await getMentorByUserId(req.user.id);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const profile = await getMentorById(req.params.id);
      if (!profile) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Mentor profile not found" },
        });
      }
      return res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", authenticate, profileValidation, async (req, res, next) => {
    try {
      const profile = await upsertMentorProfile(req.user.id, {
        background: req.body.background.trim(),
        adviceTopics: req.body.adviceTopics.map((topic) => topic.trim()),
        meetingsOffered: req.body.meetingsOffered,
        meetingLengthMinutes: req.body.meetingLengthMinutes,
      });
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createMentorsRouter;
