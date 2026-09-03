const { createAuthMiddleware } = require("../middleware/auth");

/**
 * Thin adapter for routers that are not yet wired through createApp().
 * Prefer injecting createAuthMiddleware(jwtSecret) from app.js.
 */
let authenticateWithEnvSecret;

function authenticate(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      error: {
        code: "CONFIG_ERROR",
        message: "JWT_SECRET is not configured.",
      },
    });
  }

  if (!authenticateWithEnvSecret) {
    authenticateWithEnvSecret = createAuthMiddleware(secret);
  }

  return authenticateWithEnvSecret(req, res, next);
}

module.exports = { authenticate };
