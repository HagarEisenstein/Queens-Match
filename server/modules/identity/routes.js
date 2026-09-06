const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AppError } = require("../../middleware/errors");
const {
  normalizeEmail,
  validateProfileFields,
  validateRegistration,
} = require("./validation");

function createIdentityRouters({
  userRepository,
  authenticate,
  jwtSecret,
  jwtExpiresIn = "1d",
  notificationService,
  logger = console,
}) {
  const authRouter = express.Router();
  const usersRouter = express.Router();
  const createAccessToken = (user) =>
    jwt.sign({ id: user.id, roles: user.roles }, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

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
      if (notificationService) {
        await notificationService.send({
          recipientId: user.id,
          type: "welcome",
          title: "Welcome to Queens Match!",
          message: "We’re so happy you’re here. Complete your profile to find meaningful mentorship connections and make the most of your Queens Match experience.",
          actionUrl: "/profile",
          emailEligible: true,
          emailDelayMilliseconds: 0,
          deduplicationKey: `welcome:${user.id}`,
        }).catch((error) => logger.error?.("Welcome notification failed", { error: error.message, userId: user.id }));
      }
      return res.status(201).json({ token: createAccessToken(user), user });
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
      const { password_hash, ...publicUser } = user;
      return res.json({ token, user: publicUser });
    } catch (error) {
      return next(error);
    }
  });

  usersRouter.get("/profile", authenticate, async (req, res, next) => {
    try {
      const user = await userRepository.findPublicById(req.user.id);
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
      return res.json({ user });
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
      return res.json({ user });
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
