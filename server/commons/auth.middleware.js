const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.get("authorization");
  const token = header && header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id || payload.sub;
    if (!userId) throw new Error("Invalid token payload");
    req.user = { id: userId, roles: payload.roles || [] };
    return next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}

module.exports = { authenticate };
