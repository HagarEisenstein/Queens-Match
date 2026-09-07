const express = require("express");
const { AppError } = require("../../middleware/errors");
const {
  createAccountService,
  toPublicUser,
} = require("./accountService");
const {
  normalizeEmail,
  normalizeOptionalRoles,
  validateProfileFields,
  validateRegistration,
} = require("./validation");

function createIdentityRouters({
  userRepository,
  authenticate,
  jwtSecret,
  jwtExpiresIn = "1d",
  notificationService,
  verifyNeonToken,
  logger = console,
}) {
  const authRouter = express.Router();
  const usersRouter = express.Router();
  const accountService = createAccountService({
    userRepository,
    jwtSecret,
    jwtExpiresIn,
    notificationService,
    logger,
  });

  authRouter.post("/register", async (req, res, next) => {
    try {
      const { email, password, roles, profile } = validateRegistration(req.body);
      const session = await accountService.registerPassword({
        email,
        password,
        roles,
        profile,
      });
      return res.status(201).json({
        token: session.token,
        user: session.user,
      });
    } catch (error) {
      if (error.code === "23505") {
        return next(
          new AppError(
            409,
            "ACCOUNT_EXISTS",
            "An account with that email or username already exists."
          )
        );
      }
      return next(error);
    }
  });

  authRouter.post("/login", async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      if (!email || typeof req.body.password !== "string") {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Email and password are required."
        );
      }

      const session = await accountService.loginPassword({
        email,
        password: req.body.password,
      });
      return res.json(session);
    } catch (error) {
      return next(error);
    }
  });

  authRouter.post("/neon", async (req, res, next) => {
    try {
      if (typeof verifyNeonToken !== "function") {
        throw new AppError(
          503,
          "NEON_AUTH_UNCONFIGURED",
          "Neon Auth is not configured on this server."
        );
      }

      const neonToken =
        typeof req.body?.neonToken === "string"
          ? req.body.neonToken
          : typeof req.headers.authorization === "string" &&
              req.headers.authorization.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : null;

      let identity;
      try {
        identity = await verifyNeonToken(neonToken);
      } catch (error) {
        const safeDetails =
          error.details && typeof error.details === "object"
            ? error.details
            : undefined;

        if (error.code === "NEON_AUTH_UNCONFIGURED") {
          throw new AppError(
            503,
            "NEON_AUTH_UNCONFIGURED",
            "Neon Auth is not configured on this server."
          );
        }
        if (error.code === "NEON_TOKEN_MISSING") {
          throw new AppError(
            401,
            "NEON_TOKEN_MISSING",
            "Neon Auth token is required.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_EXPIRED") {
          throw new AppError(
            401,
            "NEON_TOKEN_EXPIRED",
            "Neon Auth token has expired.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_ISSUER") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_ISSUER",
            "Neon Auth token issuer is invalid.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_AUDIENCE") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_AUDIENCE",
            "Neon Auth token audience is invalid.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_SIGNATURE") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_SIGNATURE",
            "Neon Auth token signature is invalid.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_MISSING_CLAIMS") {
          throw new AppError(
            401,
            "NEON_TOKEN_MISSING_CLAIMS",
            "Neon Auth token is missing required identity claims.",
            safeDetails
          );
        }
        if (error.code === "NEON_TOKEN_UNVERIFIED_EMAIL") {
          throw new AppError(
            401,
            "NEON_TOKEN_UNVERIFIED_EMAIL",
            "Neon Auth identity must contain a verified email.",
            safeDetails
          );
        }
        throw new AppError(
          401,
          error.code && String(error.code).startsWith("NEON_")
            ? error.code
            : "INVALID_NEON_TOKEN",
          error.message || "Neon Auth token is invalid.",
          safeDetails
        );
      }

      const roles = normalizeOptionalRoles(req.body?.roles);
      const session = await accountService.loginWithNeonIdentity(identity, {
        roles,
      });
      return res.status(session.created ? 201 : 200).json(session);
    } catch (error) {
      if (error.code === "23505") {
        return next(
          new AppError(
            409,
            "ACCOUNT_EXISTS",
            "An account with that email or username already exists."
          )
        );
      }
      return next(error);
    }
  });

  usersRouter.get("/profile", authenticate, async (req, res, next) => {
    try {
      const user = await userRepository.findPublicById(req.user.id);
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  usersRouter.put("/profile", authenticate, async (req, res, next) => {
    try {
      const profile = validateProfileFields(req.body);
      if (Object.keys(profile).length === 0) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "At least one profile field is required."
        );
      }
      const user = await userRepository.updateProfile(req.user.id, profile);
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      if (error.code === "23505") {
        return next(
          new AppError(
            409,
            "USERNAME_EXISTS",
            "That username is already in use."
          )
        );
      }
      return next(error);
    }
  });

  return { authRouter, usersRouter };
}

module.exports = { createIdentityRouters };
