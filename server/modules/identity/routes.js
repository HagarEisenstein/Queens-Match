const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { AppError } = require("../../middleware/errors");
const {
  normalizeEmail,
  validateInviteAcceptance,
  validateProfileFields,
  validateRegistration,
} = require("./validation");
const { getAvatarStorageConfigError } = require("./avatarStorage");

function createIdentityRouters({
  userRepository,
  authenticate,
  jwtSecret,
  jwtExpiresIn = "1d",
  adminInviteRepository,
  notificationService,
  logger = console,
  avatarStorage = null,
}) {
  const authRouter = express.Router();
  const usersRouter = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, callback) {
      const allowedMimeTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
          new AppError(
            400,
            "INVALID_AVATAR_FILE",
            "Avatar must be a JPEG, PNG, or WebP image."
          )
        );
      }
      return callback(null, true);
    },
  });
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

  authRouter.get("/accept-invite", async (req, res, next) => {
    try {
      const token =
        typeof req.query.token === "string" ? req.query.token.trim() : "";
      if (!token) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invite token is required."
        );
      }
      const invite = await adminInviteRepository.findActiveByToken(token);
      if (!invite) {
        throw new AppError(
          404,
          "INVITE_NOT_FOUND",
          "This invite is invalid or has expired."
        );
      }
      const existingUser = await userRepository.findAuthByEmail(invite.email);
      return res.json({
        invite: {
          email: invite.email,
          expires_at: invite.expires_at,
          hasAccount: Boolean(existingUser),
          username: existingUser?.username || "",
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  authRouter.post("/accept-invite", async (req, res, next) => {
    try {
      const previewToken =
        typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!previewToken) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invite token is required."
        );
      }

      const invite = await adminInviteRepository.findActiveByToken(previewToken);
      if (!invite) {
        throw new AppError(
          404,
          "INVITE_NOT_FOUND",
          "This invite is invalid or has expired."
        );
      }

      const existingUser = await userRepository.findAuthByEmail(invite.email);
      const { token, password, profile } = validateInviteAcceptance(req.body, {
        requireUsername: !existingUser,
      });
      const password_hash = await bcrypt.hash(
        password,
        Number(process.env.BCRYPT_ROUNDS) || 12
      );

      let user;
      if (existingUser) {
        const roles = [...new Set([...(existingUser.roles || []), "admin"])];
        user = await userRepository.updateAuthAndRoles(existingUser.id, {
          password_hash,
          roles,
        });
      } else {
        user = await userRepository.create({
          email: invite.email,
          password_hash,
          roles: ["admin"],
          ...profile,
        });
      }

      await adminInviteRepository.markAccepted(invite.id, user.id);
      return res.json({ token: createAccessToken(user), user });
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

  usersRouter.post(
    "/avatar",
    authenticate,
    (req, res, next) => {
      upload.single("avatar")(req, res, (error) => {
        if (error?.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(
              400,
              "AVATAR_TOO_LARGE",
              "Avatar must be 5MB or smaller."
            )
          );
        }
        return error ? next(error) : next();
      });
    },
    async (req, res, next) => {
      try {
        if (!avatarStorage) {
          const configError = getAvatarStorageConfigError();
          throw new AppError(
            503,
            "AVATAR_STORAGE_NOT_CONFIGURED",
            configError || "Avatar storage is not configured."
          );
        }
        if (!req.file) {
          throw new AppError(
            400,
            "AVATAR_REQUIRED",
            "Attach an avatar image using the avatar field."
          );
        }

        const avatarUrl = await avatarStorage.uploadUserAvatar({
          userId: req.user.id,
          file: req.file,
        });
        const user = await userRepository.updatePhotoUrl(req.user.id, avatarUrl);
        if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found.");

        return res.status(201).json({ user, photoUrl: user.photo_url });
      } catch (error) {
        console.error("Avatar upload failed", {
          message: error.message,
          stack: error.stack,
          code: error.code,
          userId: req.user?.id,
          hasFile: Boolean(req.file),
          mimeType: req.file?.mimetype,
          size: req.file?.size,
        });
        return next(error);
      }
    }
  );

  return { authRouter, usersRouter };
}

module.exports = { createIdentityRouters };
