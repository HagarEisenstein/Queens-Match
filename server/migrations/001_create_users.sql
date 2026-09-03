CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  username text NOT NULL UNIQUE,
  roles text[] NOT NULL DEFAULT ARRAY['mentee']::text[],
  full_name text,
  photo_url text,
  github_url text,
  linkedin_url text,
  job text,
  workplace text,
  years_experience integer,
  tech_stack text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_roles_nonempty CHECK (cardinality(roles) > 0),
  CONSTRAINT users_roles_allowed
    CHECK (roles <@ ARRAY['mentee', 'mentor', 'admin']::text[]),
  CONSTRAINT users_years_experience_nonnegative
    CHECK (years_experience IS NULL OR years_experience >= 0)
);
