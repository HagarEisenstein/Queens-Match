const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../commons/validation.middleware");
const { embedSearchQuery } = require("../services/embeddingService");
const {
  generateMentorSearchEmbedding,
} = require("../services/mentorSearchEmbeddingService");
const {
  searchMentorsBySemanticQuery,
} = require("../services/mentorSemanticSearchService");

const queryValidation = [
  body().custom((requestBody) => {
    if (
      !requestBody ||
      typeof requestBody !== "object" ||
      Array.isArray(requestBody) ||
      Object.keys(requestBody).some((key) => key !== "query")
    ) {
      throw new Error("request body may only contain query");
    }
    return true;
  }),
  body("query")
    .isString()
    .withMessage("query must be a non-empty string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("query must be a non-empty string"),
  validate,
];

const mentorProfileIdValidation = [body("mentorProfileId").isUUID(), validate];

function createMentorSearchRouter({ authenticate, authorizeAdmin }) {
  const router = express.Router();

  router.use(authenticate);
  router.post("/", queryValidation, async (req, res, next) => {
    try {
      const mentors = await searchMentorsBySemanticQuery(req.body.query);
      res.json({ mentors });
    } catch (error) {
      next(error);
    }
  });
  router.post("/embedding", queryValidation, async (req, res, next) => {
    try {
      const embedding = await embedSearchQuery(req.body.query);
      res.json({ ok: true, dimension: embedding.length });
    } catch (error) {
      next(error);
    }
  });
  // Temporary deployment-verification endpoint; remove after production validation.
  router.post(
    "/admin/mentor-embedding",
    authorizeAdmin,
    mentorProfileIdValidation,
    async (req, res, next) => {
      try {
        const result = await generateMentorSearchEmbedding(
          req.body.mentorProfileId
        );
        const { mentorProfileId, updated, dimensions, model } = result;
        res.json({ mentorProfileId, updated, dimensions, model });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

module.exports = createMentorSearchRouter;
