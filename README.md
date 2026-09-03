# Queens Match

Mentor / mentee matching app — Express + PostgreSQL backend, React (CRA) frontend.

## Architecture

- **Server:** modular Express app (`identity`, mentors, `comms`) + shared middleware
- **Database:** PostgreSQL (Prisma migrations; identity also uses `pg`)
- **Client:** React + MUI, Bearer JWT in `localStorage`, CRA proxy to `:5000` in development
- **Production:** one Render web service serves `/api/*` and the built SPA from `client/build`

## Prerequisites

- Node.js **20.x**
- npm
- Docker (recommended for local Postgres) **or** any local PostgreSQL 14+

## Local setup

```bash
git clone <your-fork-url>
cd QueenB-Task-Management-Application

npm install
npm run install-all

# Start Postgres (matches server/.env.example)
docker compose up -d

cd server
cp .env.example .env
# Set JWT_SECRET to a long random string
npx prisma migrate deploy
cd ..

npm run dev
```

- API: http://localhost:5000 (`GET /api/health`)
- UI: http://localhost:3000

### Environment variables

See `server/.env.example`. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs auth tokens |

For hosted Postgres, append `?sslmode=require` to `DATABASE_URL`.

## Deploy (free, GitHub-integrated) — Render + Neon

Vercel is a poor fit for this backend (long-lived Express, `node-cron`, in-memory SSE). Use **Render**.

### 1. Postgres (Neon free)

1. Create a project at [https://neon.tech](https://neon.tech)
2. Copy the connection string (include SSL / `sslmode=require`)

### 2. Push to GitHub

Push this repo to a GitHub remote you own.

### 3. Render Blueprint

1. Open [https://dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect the GitHub repo
3. Render reads `render.yaml`
4. Set `DATABASE_URL` to the Neon URL when prompted (`sync: false` in the Blueprint)
5. Deploy

**Build:** install deps → `prisma migrate deploy` → `npm run build` (client)  
**Start:** `npm start` (Express serves API + `client/build`)

### 4. Verify

- `https://<your-service>.onrender.com/api/health` → `status: "healthy"`, `database: "up"`
- Open the same origin in a browser → Register → Log in

**Free-tier note:** Render sleeps after idle ~15 minutes (cold start on next visit; cron jobs pause while asleep).

### Manual Render service (without Blueprint)

| Setting | Value |
|---|---|
| Root directory | repo root |
| Build command | `npm install && npm run install-all && npm run db:migrate:deploy && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Env | `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, … |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Client + server (development) |
| `npm run build` | Production React build |
| `npm start` | Production Express server |
| `npm test` | Server + client tests |
| `npm run db:migrate:deploy` | Apply Prisma migrations (CI/prod) |

## Notifications

Default `NOTIFICATION_PROVIDER=console`. For email via Brevo SMTP, set provider + `EMAIL_*` in `server/.env` (see `.env.example`).

## License

MIT
