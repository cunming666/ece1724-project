# ECE1724 Project 3 - Event Ticketing and QR Check-in System

Campus event check-in platform (Organizer / Staff / Attendee) built with React + Express + TypeScript.

## Current Status (as of 2026-03-21)
- The project is runnable end-to-end as an MVP.
- Authentication, event registration, waitlist promotion, check-in APIs, and real-time dashboard are available.
- Demo bootstrap accounts and data are available for direct presentation use.
- Core requirements are mostly complete.
- External API integration (OpenWeather) added with a floating weather card.

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query
- Backend: Express + TypeScript + Socket.IO + Zod
- Data: Prisma schema prepared (SQLite now, planned PostgreSQL migration)
- Shared package: common types/constants in packages/shared

## Repository Structure
apps/web         # React frontend  
apps/api         # Express backend  
packages/shared  # shared types/constants  
prisma           # schema and migrations  
docs             # API notes, test cases, demo playbook  
scripts          # helper scripts (demo bootstrap)  

## Quick Start
1. Install dependencies  
npm install  

2. Create environment file  
copy .env.example .env  

3. Run frontend + backend  
npm run dev  

4. Seed demo data  
npm run demo:bootstrap  

## Environment Variables
Create `.env` in apps/api:

OPENWEATHER_API_KEY=your_api_key_here

## URLs
- Web: http://localhost:5173  
- API health: http://localhost:4000/health  
- Socket.IO endpoint: http://localhost:4000  

## Demo Accounts
After npm run demo:bootstrap:
- organizer.demo@utoronto.ca / pass1234  
- staff.demo@utoronto.ca / pass1234  
- attendee1.demo@utoronto.ca / pass1234  
- attendee2.demo@utoronto.ca / pass1234  
- attendee3.demo@utoronto.ca / pass1234  

## Completed in MVP
- [x] Auth API: sign-up / sign-in / sign-out / session  
- [x] RBAC base middleware (ORGANIZER / STAFF / ATTENDEE)  
- [x] Event API (create, list, publish, details)  
- [x] Registration + waitlist promotion logic  
- [x] Ticket generation + QR/manual check-in API  
- [x] Duplicate check-in detection  
- [x] Real-time dashboard refresh (Socket.IO)  
- [x] Login-first frontend flow  
- [x] Demo bootstrap script  
- [x] API integration tests  
- [x] External API integration (OpenWeather weather card with floating UI)  

## Remaining Work (Unified Checklist)

### P0 (Core System)
- [x] Replace in-memory store with Prisma database persistence  
- [x] Add Prisma migrations and seed flow  
- [x] Implement cloud storage integration (S3/Spaces)  
- [x] Implement CSV attendee import parsing and summary  
- [x] Staff assignment management flow (API + UI)  

### P1 (Frontend + UX)
- [x] Attendee ticket page (QR display)  
- [x] Staff check-in page (scan/manual)  
- [x] Organizer publish action in UI  
- [x] Fix text encoding issues  
- [x] RBAC boundary enforcement  
- [x] Weather floating card (external API feature)  

### P2 (Final Polish)
- [ ] PostgreSQL migration verification  
- [ ] Frontend E2E tests  
- [ ] Improve README to final-report format  
- [ ] Add ai-session.md  
- [ ] Add demo video link  

## Definition of Done
- Database persistence works across restarts  
- Cloud storage works with real uploads/downloads  
- CSV import produces correct summary results  
- Check-in UI works with real-time dashboard updates  
- RBAC enforced across all endpoints  

## Testing
Run API tests:
npm test -w @checkin/api  

Run all tests:
npm test  

## Project Docs
- API list: docs/API.md  
- Demo playbook: docs/DEMO_PLAYBOOK.md  
- Test cases: docs/TEST_CASES.md  