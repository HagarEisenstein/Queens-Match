const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../commons/validation.middleware");
const { embedText } = require("../services/embeddingService");

const queryValidation = [
  body("query")
    .isString()
    .withMessage("query must be a non-empty string")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("query must be a non-empty string"),
  validate,
];

function createMentorSearchRouter({ authenticate }) {
  const router = express.Router();

  router.use(authenticate);
  router.post("/embedding", queryValidation, async (req, res, next) => {
    try {
      const embedding = await embedText(req.body.query);
      res.json({ ok: true, dimension: embedding.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createMentorSearchRouter;
