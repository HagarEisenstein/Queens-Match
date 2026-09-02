function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const hasRole = req.user && req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
    }
    return next();
  };
}

module.exports = { requireRole };
