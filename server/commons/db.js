const { PrismaClient } = require("@prisma/client");

/**
 * Prisma reads DATABASE_URL from the environment (see prisma/schema.prisma).
 * For hosted Postgres, include TLS in the URL (e.g. ?sslmode=require) so Prisma
 * and the raw `pg` pool in ../db.js share the same connection semantics.
 */
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["warn", "error"]
      : ["error"],
});

module.exports = prisma;
