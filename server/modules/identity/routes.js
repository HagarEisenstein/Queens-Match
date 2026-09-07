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

// Verification failures are reported with their own code so a misconfigured
// server (503) is never mistaken for a rejected user token (401).
const NEON_ERROR_RESPONSES = {
  NEON_AUTH_UNCONFIGURED: [503, "Neon Auth is not configured on this server."],
  NEON_JWKS_UNAVAILABLE: [
    503,
    "Unable to load the Neon Auth JWKS for verification.",
  ],
  NEON_TOKEN_MISSING: [401, "Neon Auth token is required."],
  NEON_TOKEN_EXPIRED: [401, "Neon Auth token has expired."],
  NEON_TOKEN_INVALID_ISSUER: [401, "Neon Auth token issuer is invalid."],
  NEON_TOKEN_INVALID_AUDIENCE: [401, "Neon Auth token audience is invalid."],
  NEON_TOKEN_INVALID_SIGNATURE: [401, "Neon Auth token signature is invalid."],
  NEON_TOKEN_MISSING_CLAIMS: [
    401,
    "Neon Auth token is missing required identity claims.",
  ],
  NEON_TOKEN_UNVERIFIED_EMAIL: [
    401,
    "Neon Auth identity must contain a verified email.",
  ],
};

function toNeonAppError(error) {
  const details =
    error.details && typeof error.details === "object"
      ? error.details
      : undefined;
  const mapped = NEON_ERROR_RESPONSES[error.code];

  if (mapped) {
    const [status, message] = mapped;
    return new AppError(status, error.code, message, details);
  }

  return new AppError(
    401,
    error.code && String(error.code).startsWith("NEON_")
      ? error.code
      : "INVALID_NEON_TOKEN",
    error.message || "Neon Auth token is invalid.",
    details
  );
}

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
        throw toNeonAppError(error);
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
