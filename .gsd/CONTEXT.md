# Project Context

- Backend: Node.js, Express, Prisma 6, PostgreSQL 16.
- Architecture: modular monolith with Prisma as the database access layer.
- Existing data uses PostgreSQL text arrays for roles, tech stack, and advice topics.
- Compatibility requirement: preserve existing route/service field names while strengthening database constraints.
- Vector integration uses PostgreSQL `pgvector` with 1536-dimensional embeddings.
- The project has existing test drift in mentor profile expectations and sandbox restrictions may prevent Supertest from binding sockets.
