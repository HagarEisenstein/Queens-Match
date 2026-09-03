const jwt = require("jsonwebtoken");
const { AppError } = require("./errors");

function createAuthMiddleware(jwtSecret) {
  return function authenticate(req, res, next) {
    const authorization = req.get("authorization");
    const [scheme, token] = authorization ? authorization.split(" ") : [];

    if (scheme !== "Bearer" || !token) {
      return next(
        new AppError(401, "AUTH_REQUIRED", "A valid bearer token is required.")
      );
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      if (!payload.id || !Array.isArray(payload.roles)) {
        throw new Error("Invalid token payload");
      }
      req.user = { id: payload.id, roles: payload.roles };
      return next();
    } catch (error) {
      return next(
        new AppError(401, "INVALID_TOKEN", "The authentication token is invalid or expired.")
      );
    }
  };
}

function requireAnyRole(...capabilities) {
  return function authorize(req, res, next) {
    const allowed = capabilities.some((role) => req.user.roles.includes(role));
    if (!allowed) {
      return next(
        new AppError(403, "FORBIDDEN", "You do not have this capability.")
      );
    }
    return next();
  };
}

module.exports = { createAuthMiddleware, requireAnyRole };
