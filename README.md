# Shop Operations System

Retail operations platform for backoffice management, front-desk sales, trade-ins, deliveries, and a public storefront.

## Stack

- React 19 + Vite + TypeScript
- Express API
- Drizzle ORM
- SQLite for local-first development, PostgreSQL-compatible via `DATABASE_URL`
- Tailwind CSS + Radix UI components
- Vitest for regression coverage

## Features

- Admin dashboard, POS, products, customers, repairs, expenses, closures
- Orders, deliveries, notifications, and storefront commerce flows
- Product image uploads with persistent local storage
- Barcode-based product lookup for POS
- Guided trade-in and buyback intake with base-value matching
- Multi-shop aware data model

## Local Setup

### 1. Install

```bash
npm install
cp .env.example .env
```

### 2. Configure environment

Default local development uses SQLite:

```env
NODE_ENV=development
PORT=5000
HOST=127.0.0.1
DATABASE_URL=./.data/dev.sqlite
VITE_API_URL=http://127.0.0.1:5000
TZ=Africa/Kampala
```

To use PostgreSQL instead, set `DATABASE_URL` to your Postgres connection string.

### 3. Start the app

```bash
npm run dev
```

Core routes:

- Admin / staff app: `http://127.0.0.1:5000`
- POS: `http://127.0.0.1:5000/pos`
- Trade-in: `http://127.0.0.1:5000/trade-in`
- Storefront: `http://127.0.0.1:5000/store`

## Database

Push the current Drizzle schema to the configured database:

```bash
npm run db:push
```

Optional seed helpers:

```bash
npm run seed:users
npm run seed:base-values
npm run seed:all
```

## Verification

```bash
npm run check
npm test
npm run build
```

## Monitoring

Sentry is env-gated for both client and server. Set these before deploy:

```env
SENTRY_DSN=...
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
VITE_SENTRY_DSN=...
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Checkly synthetic monitoring is configured in `checkly.config.ts` with public checks under `checkly/`.
Use `CHECKLY_PUBLIC_BASE_URL` to target the deployed site, then run:

```bash
npx checkly test
npx checkly deploy
```

## Scripts

```bash
npm run dev              # start the app in development
npm run check            # TypeScript type-check
npm test                 # run the Vitest suite
npm run build            # build production assets into dist/
npm start                # run the production server from dist/
npm run db:push          # apply Drizzle schema to the current database
npm run seed:users       # create baseline users
npm run seed:base-values # seed trade-in base values
```

## Project Structure

```text
client/src/
  components/   reusable UI
  lib/          client helpers and state
  pages/        routed screens
server/
  middleware/   async/error/auth helpers
  services/     domain logic
  utils/        response and formatting helpers
  __tests__/    integration and regression tests
shared/
  shared schema and helpers
uploads/
  runtime file uploads (ignored by git)
.data/
  local SQLite database (ignored by git in fresh clones)
```

## Deployment Notes

- Do not commit `.env`.
- Use a persistent filesystem or object storage for `uploads/` in production.
- Ensure `DATABASE_URL` points to a durable database in production.
- Run `npm run check`, `npm test`, and `npm run build` before deployment.
- Render deployments can use [render.yaml](/Users/ario/ariostore-ug/Chat-Interface-Builder/render.yaml) with `/health` as the public health check endpoint.
- GitHub Actions production deploy automation is Render-based and expects `RENDER_DEPLOY_HOOK_URL` plus `DEPLOY_HEALTHCHECK_URL` secrets.

## Docker

```bash
docker compose up --build
```

This runs the production build on port `5000` and persists local data in Docker volumes.
