const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AppError } = require("../../middleware/errors");
const {
  normalizeEmail,
  normalizeOptionalRoles,
  validateProfileFields,
  validateRegistration,
} = require("./validation");

function toPublicUser(user) {
  if (!user) return null;
  const { password_hash, neon_auth_user_id, ...publicUser } = user;
  return publicUser;
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
  const createAccessToken = (user) =>
    jwt.sign({ id: user.id, roles: user.roles }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

  async function sendWelcome(user) {
    if (!notificationService) return;
    await notificationService
      .send({
        recipientId: user.id,
        type: "welcome",
        title: "Welcome to Queen's Match!",
        message:
          "We’re so happy you’re here. Complete your profile to find meaningful mentorship connections and make the most of your Queen's Match experience.",
        actionUrl: "/profile",
        emailEligible: true,
        emailDelayMilliseconds: 0,
        deduplicationKey: `welcome:${user.id}`,
      })
      .catch((error) =>
        logger.error?.("Welcome notification failed", {
          error: error.message,
          userId: user.id,
        })
      );
  }

  authRouter.post("/register", async (req, res, next) => {
    try {
      const { email, password, roles, profile } = validateRegistration(req.body);
      const password_hash = await bcrypt.hash(
        password,
        Number(process.env.BCRYPT_ROUNDS) || 12
      );
      const user = await userRepository.create({
        email,
        password_hash,
        roles,
        ...profile,
      });
      await sendWelcome(user);
      return res.status(201).json({ token: createAccessToken(user), user: toPublicUser(user) });
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

      const user = await userRepository.findAuthByEmail(email);
      if (user && !user.password_hash) {
        throw new AppError(
          401,
          "OAUTH_ONLY_ACCOUNT",
          "This account uses Google sign-in. Continue with Google."
        );
      }

      const validPassword =
        user && (await bcrypt.compare(req.body.password, user.password_hash));
      if (!validPassword) {
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect."
        );
      }

      const token = createAccessToken(user);
      return res.json({ token, user: toPublicUser(user) });
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
            "Neon Auth token is required."
          );
        }
        if (error.code === "NEON_TOKEN_EXPIRED") {
          throw new AppError(
            401,
            "NEON_TOKEN_EXPIRED",
            "Neon Auth token has expired."
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_ISSUER") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_ISSUER",
            "Neon Auth token issuer is invalid."
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_AUDIENCE") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_AUDIENCE",
            "Neon Auth token audience is invalid."
          );
        }
        if (error.code === "NEON_TOKEN_INVALID_SIGNATURE") {
          throw new AppError(
            401,
            "NEON_TOKEN_INVALID_SIGNATURE",
            "Neon Auth token signature is invalid."
          );
        }
        if (error.code === "NEON_TOKEN_MISSING_CLAIMS") {
          throw new AppError(
            401,
            "NEON_TOKEN_MISSING_CLAIMS",
            "Neon Auth token is missing required identity claims."
          );
        }
        throw new AppError(
          401,
          "INVALID_NEON_TOKEN",
          error.message || "Neon Auth token is invalid."
        );
      }

      let user =
        (await userRepository.findByNeonAuthUserId?.(identity.neonUserId)) ||
        null;

      if (!user) {
        const existing = await userRepository.findAuthByEmail(identity.email);
        if (existing) {
          if (
            existing.neon_auth_user_id &&
            existing.neon_auth_user_id !== identity.neonUserId
          ) {
            throw new AppError(
              409,
              "NEON_IDENTITY_CONFLICT",
              "This email is already linked to a different Google identity."
            );
          }
          user = userRepository.linkNeonAuthUserId
            ? await userRepository.linkNeonAuthUserId(
                existing.id,
                identity.neonUserId
              )
            : existing;
          if (!user) user = toPublicUser(existing);
        }
      }

      let created = false;
      if (!user) {
        const roles = normalizeOptionalRoles(req.body?.roles);
        user = await userRepository.createFromNeonIdentity(identity, { roles });
        created = true;
        await sendWelcome(user);
      }

      const publicUser = toPublicUser(user);
      return res.status(created ? 201 : 200).json({
        token: createAccessToken(publicUser),
        user: publicUser,
        created,
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
