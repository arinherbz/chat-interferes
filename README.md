# Ariostore Gadgets

Commerce, POS, repairs, delivery, and admin operations system built with Express, React, Drizzle, and Postgres, with SQLite fallback for local development and tests.

## Local Run

```bash
npm install
cp .env.example .env
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5050
```

The app serves both API and frontend from the same process in local development.

## Required Checks

```bash
npm run check
npm test
npm run build
```

All three should pass before pushing to GitHub or deploying to Render.

## Environment

Copy [.env.example](/Users/ario/ariostore%20ug/Chat-Interface-Builder/.env.example) to `.env` and set:

- `DATABASE_URL` to your Neon Postgres connection string for production-like development
- `SESSION_SECRET` to a strong random value
- `ALLOWED_ORIGINS` when frontend and backend are hosted on different origins
- `VITE_API_URL` only when the frontend should call a different API origin

For simple same-origin local development, leave `VITE_API_URL` blank.

## Health Endpoints

- `/healthz` for basic uptime checks
- `/readyz` for database readiness checks
- `/api/system/health` for authenticated owner-only diagnostics

## Deployment

Render config lives in [render.yaml](/Users/ario/ariostore%20ug/Chat-Interface-Builder/render.yaml).

Production expectations:

- Render web service runs `npm run start`
- Neon Postgres is configured through `DATABASE_URL`
- `SESSION_COOKIE_SECURE=true`
- `HOST=0.0.0.0`
- health check points at `/healthz`

## Main Folders

```text
client/src/components
client/src/lib
client/src/pages
server
shared
script
```

## Git Workflow

```bash
git checkout -b feature/<scope>
git add <files>
git commit -m "feat: summary"
git push -u origin feature/<scope>
```

Use feature branches for all active work. Keep `main` production-ready.
