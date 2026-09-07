# Project Context

- Backend: Node.js 20+, Express, Prisma 6.19.3, PostgreSQL 16.
- Architecture: modular monolith with Prisma as the database access layer.
- Existing data uses PostgreSQL text arrays for roles, tech stack, and advice topics.
- Compatibility requirement: preserve existing route/service field names while strengthening database constraints.
- Mentor search embeddings use `gemini-embedding-001` at exactly 768 dimensions and are stored in PostgreSQL `pgvector` separately from mentor profiles.
- Prisma 6 represents the vector column as `Unsupported("vector(768)")`; vector persistence uses parameterized raw SQL.
- Semantic mentor retrieval is available through the authenticated Help Me flow and uses the full mentor search document (background, advice topics, job, workplace, and tech stack).
- Mentor-entered advice topics may be built-in or free text; only query-understanding output is restricted to the seven built-in Queens Match topics.
- Product relevance must dominate hybrid mentor ranking without hard-filtering mentors that lack an explicit built-in topic.
