const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AppError } = require("../../middleware/errors");

function toPublicUser(user) {
  if (!user) return null;
  const { password_hash, neon_auth_user_id, ...publicUser } = user;
  return publicUser;
}

function createAccountService({
  userRepository,
  jwtSecret,
  jwtExpiresIn = "1d",
  notificationService,
  logger = console,
  bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 12,
}) {
  const issueSession = (user) => {
    const publicUser = toPublicUser(user);
    return {
      token: jwt.sign(
        { id: publicUser.id, roles: publicUser.roles },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      ),
      user: publicUser,
    };
  };

  async function sendWelcome(user) {
    if (!notificationService) return;
    await notificationService
      .send({
        recipientId: user.id,
        type: "welcome",
        title: "Welcome to Queen's Match!",
        message:
          "We’re so happy you’re here. Complete your profile to find meaningful mentorship connections and make the most of your Queen's Match experience.",
        actionUrl: "/profile?welcome=1",
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

  async function registerPassword({ email, password, roles, profile }) {
    const password_hash = await bcrypt.hash(password, bcryptRounds);
    const user = await userRepository.create({
      email,
      password_hash,
      roles,
      ...profile,
    });
    await sendWelcome(user);
    return { ...issueSession(user), created: true };
  }

  async function loginPassword({ email, password }) {
    const user = await userRepository.findAuthByEmail(email);
    if (user && !user.password_hash) {
      throw new AppError(
        401,
        "OAUTH_ONLY_ACCOUNT",
        "This account uses Google sign-in. Continue with Google."
      );
    }

    const validPassword =
      user && (await bcrypt.compare(password, user.password_hash));
    if (!validPassword) {
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect."
      );
    }

    return issueSession(user);
  }

  async function findOrCreateNeonUser(identity, roles) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const linked =
        (await userRepository.findByNeonAuthUserId(identity.neonUserId)) || null;
      if (linked) return { user: linked, created: false };

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

        try {
          const user = await userRepository.linkNeonAuthUserId(
            existing.id,
            identity.neonUserId
          );
          if (user) return { user, created: false };
        } catch (error) {
          if (error.code !== "23505") throw error;
          continue;
        }
      } else {
        try {
          const user = await userRepository.createFromNeonIdentity(identity, {
            roles,
          });
          return { user, created: true };
        } catch (error) {
          if (error.code !== "23505") throw error;
          continue;
        }
      }
    }

    throw new AppError(
      409,
      "ACCOUNT_LINK_CONFLICT",
      "Unable to safely link this Google identity to a QueenB account."
    );
  }

  async function loginWithNeonIdentity(identity, { roles }) {
    if (
      !identity ||
      typeof identity.neonUserId !== "string" ||
      !identity.neonUserId ||
      typeof identity.email !== "string" ||
      !identity.email ||
      identity.emailVerified !== true
    ) {
      throw new AppError(
        401,
        "NEON_TOKEN_UNVERIFIED_EMAIL",
        "Neon Auth identity must contain a verified email."
      );
    }

    const result = await findOrCreateNeonUser(identity, roles);
    if (result.created) await sendWelcome(result.user);
    return { ...issueSession(result.user), created: result.created };
  }

  return {
    issueSession,
    registerPassword,
    loginPassword,
    loginWithNeonIdentity,
  };
}

module.exports = { createAccountService, toPublicUser };
