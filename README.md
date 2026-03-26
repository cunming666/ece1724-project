# ECE1724 Project 3 - Event Ticketing and QR Check-in System

Campus event check-in platform (Organizer / Staff / Attendee) built with React + Express + TypeScript.

## Current Status (as of 2026-03-25)
- The project is runnable end-to-end as an MVP.
- Authentication, event registration, waitlist promotion, check-in APIs, and real-time dashboard are available.
- Demo bootstrap accounts and data are available for direct presentation use.
- Core requirements are mostly complete.
- External API integration (OpenWeather) is available through the organizer control panel.

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query
- Backend: Express + TypeScript + Socket.IO + Zod
- Data: Prisma + SQLite for local development, PostgreSQL-ready verification/deploy workflow
- Storage: DigitalOcean Spaces / S3-compatible presigned upload and download
- Shared package: common types/constants in `packages/shared`

## Repository Structure
```text
apps/web         # React frontend
apps/api         # Express backend
packages/shared  # shared types/constants
prisma           # schema and migrations
docs             # API notes, test cases, demo playbook
scripts          # helper scripts (demo bootstrap, local DB init)
```

## Quick Start
1. Install dependencies
```bash
npm install
```
2. Create local environment file in the project root
```bash
cp .env.example .env
# On Windows PowerShell you can also use: Copy-Item .env.example .env
```
3. Initialize the local SQLite schema
```bash
npm run db:init
```
4. Run frontend + backend
```bash
npm run dev
```
5. Seed demo data
```bash
npm run demo:bootstrap
```


## PostgreSQL Verification (Neon)
Use this flow when you need to prove PostgreSQL compatibility without breaking the default SQLite dev setup.

1. Create a temporary PostgreSQL env file (`.env.postgres.example` -> `.env`) or directly set `DATABASE_URL` in `.env` to your Neon/PostgreSQL URL.
2. Stop any running `npm run dev` process first.
3. Run:
```bash
npm run verify:postgres
```
4. After verification, set `DATABASE_URL` back to `file:./dev.db` in `.env`.
5. If needed, re-initialize local SQLite schema:
```bash
npm run db:init
```

Notes:
- `verify:postgres` runs PostgreSQL client generation, schema push, and a smoke CRUD check.
- `verify:postgres` always tries to restore the Prisma client back to SQLite at the end.
- PostgreSQL schema file is generated automatically from `prisma/schema.prisma`.

## Environment Variables
Use the project-root `.env` file. Keep real credentials only in `.env` and never commit them.

Examples:
- `.env.example` for SQLite local development
- `.env.postgres.example` for PostgreSQL verification/deploy

Required for full feature set:
- `DATABASE_URL`
- `API_PORT`
- `WEB_ORIGIN`
- `VITE_API_URL`
- `SPACES_REGION`
- `SPACES_ENDPOINT`
- `SPACES_BUCKET`
- `SPACES_ACCESS_KEY`
- `SPACES_SECRET_KEY`
- `OPENWEATHER_API_KEY`

## URLs
- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Socket.IO endpoint: `http://localhost:4000`

## Online Deployment (Production)
Recommended stack:
- Frontend: Vercel (`apps/web`)
- Backend: Render Web Service (`apps/api`)
- Database: Neon PostgreSQL
- Storage: DigitalOcean Spaces / S3-compatible

Deployment guide:
- See `docs/DEPLOYMENT.md` for end-to-end setup, environment variables, smoke checks, and rollback.
- Backend can be created from included `render.yaml` via Render Blueprint.

Post-deploy verification:
```bash
API_DEPLOY_URL="https://<your-api-domain>" WEB_DEPLOY_URL="https://<your-web-domain>" npm run smoke:deploy
```

## Demo Accounts
After `npm run demo:bootstrap`:
- `organizer.demo@utoronto.ca` / `pass1234`
- `staff.demo@utoronto.ca` / `pass1234`
- `attendee1.demo@utoronto.ca` / `pass1234`
- `attendee2.demo@utoronto.ca` / `pass1234`
- `attendee3.demo@utoronto.ca` / `pass1234`

## Completed in MVP
- [x] Auth API: sign-up / sign-in / sign-out / session
- [x] Password hashing and password change API
- [x] Event API (create, list, update, publish, details)
- [x] Registration + waitlist promotion logic
- [x] Ticket generation + QR/manual check-in API
- [x] Duplicate check-in detection
- [x] Real-time dashboard refresh (Socket.IO)
- [x] Organizer staff assignment flow
- [x] CSV attendee import with summary results
- [x] Attendee ticket wallet page
- [x] Staff check-in page (QR + manual fallback)
- [x] Demo bootstrap script
- [x] API integration tests
- [x] External API integration (OpenWeather card)

## Remaining Work
- [x] PostgreSQL migration verification tooling
- [ ] Frontend E2E tests
- [ ] Improve README to final-report format
- [ ] Add `ai-session.md`
- [ ] Add demo video link

## Teammate Setup Notes
If your teammate clones the repo, they should be able to use it after these local steps:
1. `npm install`
2. create `.env` from `.env.example` and fill in the real shared credentials
3. `npm run db:init`
4. `npm run dev`
5. `npm run demo:bootstrap`

## Testing
Run API tests:
```bash
npm test -w @checkin/api
```

Run all tests:
```bash
npm test
```

## Project Docs
- API list: `docs/API.md`
- Demo playbook: `docs/DEMO_PLAYBOOK.md`
- Deployment runbook: `docs/DEPLOYMENT.md`
- Test cases: `docs/TEST_CASES.md`
