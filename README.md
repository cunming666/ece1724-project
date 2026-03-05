# ECE1724 Project 3 - Event Ticketing and QR Check-in System

Campus event check-in platform (Organizer / Staff / Attendee) built with React + Express + TypeScript.

## Current Status (as of 2026-03-05)
- The project is runnable end-to-end as an MVP.
- Authentication, event registration, waitlist promotion, check-in APIs, and real-time dashboard are available.
- Demo bootstrap accounts and data are available for direct presentation use.
- Core requirements are not fully complete yet (database persistence and cloud storage are still scaffold-level).

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query
- Backend: Express + TypeScript + Socket.IO + Zod
- Data: Prisma schema prepared (`SQLite` now, planned `PostgreSQL` migration)
- Shared package: common types/constants in `packages/shared`

## Repository Structure
```text
apps/web         # React frontend
apps/api         # Express backend
packages/shared  # shared types/constants
prisma           # schema and migrations
docs             # API notes, test cases, demo playbook
scripts          # helper scripts (demo bootstrap)
```

## Quick Start
1. Install dependencies
```bash
npm install
```
2. Create environment file
```bash
copy .env.example .env
```
3. Run frontend + backend
```bash
npm run dev
```
4. Seed demo data and print accounts/tokens
```bash
npm run demo:bootstrap
```

## URLs
- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- Socket.IO endpoint: `http://localhost:4000`

## Demo Accounts
After `npm run demo:bootstrap`, the following accounts are ready:
- `organizer.demo@utoronto.ca` / `pass1234`
- `staff.demo@utoronto.ca` / `pass1234`
- `attendee1.demo@utoronto.ca` / `pass1234`
- `attendee2.demo@utoronto.ca` / `pass1234`
- `attendee3.demo@utoronto.ca` / `pass1234`

## Completed in MVP
- [x] Auth API: sign-up / sign-in / sign-out / session
- [x] RBAC base middleware (ORGANIZER / STAFF / ATTENDEE)
- [x] Event API skeleton (create, list, publish, details, update)
- [x] Registration + waitlist promotion logic
- [x] Ticket generation + manual/QR check-in API
- [x] Duplicate check-in detection (`isDuplicate`)
- [x] Real-time dashboard refresh using Socket.IO events
- [x] Login-first frontend flow: `/auth -> /panel -> /panel/events/:eventId/dashboard`
- [x] Demo bootstrap endpoint and script for presentation
- [x] API integration tests (`apps/api/test/api.integration.test.ts`)

## Remaining Work (Unified Checklist)
- [ ] [P0] Replace in-memory store with Prisma database persistence in runtime (`apps/api`)
- [ ] [P0] Add Prisma migrations and seed flow (`prisma/migrations`, script-based seed)
- [ ] [P0] Implement real cloud storage integration (S3/Spaces): upload + download with valid URLs
- [ ] [P0] Implement real CSV attendee import parsing/validation and summary results
- [ ] [P0] Add staff-assignment management flow (API + UI), not only bootstrap hardcode
- [ ] [P1] Add frontend attendee ticket page (QR display)
- [ ] [P1] Add frontend staff check-in page (camera scan + manual fallback)
- [ ] [P1] Add organizer publish action directly in UI (not API-only hint)
- [ ] [P1] Fix Chinese text encoding issues in frontend strings
- [ ] [P1] Tighten RBAC for ticket/file access boundaries
- [ ] [P2] Add SQLite -> PostgreSQL migration verification script and regression checks
- [ ] [P2] Add frontend E2E tests (auth -> register -> check-in -> dashboard update)
- [ ] [P2] Improve README to final-report format required by course rubric
- [ ] [P2] Add `ai-session.md` with 1-3 meaningful AI sessions
- [ ] [P2] Add video demo link (1-5 min) and optional deployment URL

## Definition of Done (Core Gaps)
- Database: service restart does not lose users/events/registrations/check-ins.
- Cloud storage: files are actually uploaded/downloaded via configured provider.
- CSV import: imports real rows and returns processed/success/failed counts.
- Check-in UI: staff can scan on mobile browser and dashboard updates in under 2 seconds.
- Auth+RBAC: attendee cannot access organizer/staff-only endpoints (verified by tests).

## Testing
- Run API tests:
```bash
npm test -w @checkin/api
```
- Run all workspace tests:
```bash
npm test
```

## Project Docs
- API list: `docs/API.md`
- Demo script/playbook: `docs/DEMO_PLAYBOOK.md`
- Test case list: `docs/TEST_CASES.md`
