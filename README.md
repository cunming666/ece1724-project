# Event Ticketing & QR Check-In System

A full-stack event management system for publishing events, managing attendees, issuing tickets, and handling on-site check-in.

## Submission Checklist

- [Done] Final report structure prepared in `README.md`
- [Done] Complete source code included in the repository
- [Done] Development guide written for local setup and testing
- [Done] Individual contributions drafted from commit history
- [Done] Fill student numbers and preferred email addresses in Section 1
- [Todo] Add screenshots in Section 6
- [Todo] Add the video demo link in Section 9
- [Done] Section 10: AI Assistance and Verification completed
- [Done] Added `ai-session.md` with representative interaction records
- [Todo] Let each team member review and revise their own contribution or reflection sections if needed
- [Todo] Final proofreading and submission

## 1. Team Information

| Name | Student Number | Preferred Email |
| --- | --- | --- |
| Shuanglong Zhu | 1012410302 | shuanglong.zhu@mail.utoronto.ca |
| Nairui Tian | 1012435330 | n.tian@mail.utoronto.ca |
| Cunming Liu | 1012826248 | cunming.liu@mail.utoronto.ca |
| Ruogu Xu | 1011038137 | ruogu.xu@mail.utoronto.ca |

## 2. Motivation

Small events often use spreadsheets, chat tools, and lists for registration and check-in. This works for really small groups, but it becomes inefficient as attendance grows. No one knows who is registered, staff check people off of outdated lists, and checking people in multiple times makes it chaotic.

We picked this project since it was a common workflow on campus and a good fit for a full-stack system. It had a frontend and backend that needed integration, and required designing a database, implementing access control, file handling and updating information in real time. We wanted to replace a collection of mottled tools with one clear workflow.

The system was built to give event organizers, staff, and attendees one system for their event operations. Organizers manage events and rosters, staff check people in, and attendees access their tickets. Keeping things unified makes it easier to keep things simple.

## 3. Objectives

The goal was to create a complete event ticketing and check-in system for small events. This is not just an event information page; it was designed to handle the complete life cycle, culminating in entry verification at the door.

We aimed to:

- build a separated React frontend and Express backend
- authorize organizer, staff, and attendee roles with different permission levels
- allow organizers to create and publish events and to manage rosters and assign staff
- allow attendees to view which tickets they are assigned to attend
- allow staff check-in via QR or manual on-site
- ensure consistency of event, ticket, and check-in data in the database
- support event cover uploads and CSV import of attendees through the use of cloud storage
- view live updates on attendance during check-in

Thus, we wanted to build a clear, usable system that covers the basic event workflow and meets the technical requirements of the course project.

## 4. Technical Stack

### 4.1 Frontend

- React 18 and TypeScript
- Vite for local development and production build
- React Router for page routing
- TanStack Query for server data fetching and cache invalidation
- Redux Toolkit and React Redux for session and UI state
- Tailwind CSS, PostCSS, and Autoprefixer for styling
- `html5-qrcode` for browser-based QR scanning
- `socket.io-client` for live dashboard updates

### 4.2 Backend

- Express.js and TypeScript
- Zod for request validation
- Prisma Client for database access
- `bcryptjs` for password hashing
- `cookie-parser` and CORS middleware for session handling and browser access
- Socket.IO for real-time attendance updates
- `qrcode` for ticket QR generation
- `dotenv` for environment configuration

### 4.3 Database

- Prisma ORM
- SQLite for local development
- PostgreSQL schema support for deployment and compatibility testing
- Main data models: `User`, `Session`, `Event`, `Registration`, `Ticket`, `CheckinLog`, `StaffAssignment`, `FileObject`, and `ImportJob`

### 4.4 Cloud Storage and External Services

- Cloud object storage uses DigitalOcean Spaces (S3 compatible)
- File uploads are done via the AWS SDK v3 and pre-signed upload/download URLs for transferring files
- Event cover images and attendee CSV files are stored in cloud object storage
- Weather data comes from the OpenWeather API for the dashboard

### 4.5 Project Structure and Testing

- npm workspaces for organizing the monorepo apps: `apps/web`, `apps/api`, and `packages/shared`
- `@checkin/shared` for shared types and common contracts
- use of `concurrently` to allow the frontend and backend to run simultaneously in development
- Vitest and Supertest for backend tests
- Playwright for end-to-end browser tests

## 5. Features

### 5.1 Organizer Features

- Ability to create events (draft, with title, location, time, and capacity)
- Ability to upload event cover images to cloud storage
- Publish events to the event board
- Assign staff to each event
- Import attendees from CSV files
- Add or remove an attendee in the roster page
- View event roster, attendance status, and live dashboard

### 5.2 Staff Features

- Open assigned events from the event board
- View event roster
- Check attendees in via QR scan
- Check attendees in manually by ticket ID
- View recent check-ins and progress during the event

### 5.3 Attendee Features

- Register and sign in to the system
- View assigned tickets in the ticket page
- Open a QR code for each active ticket
- Copy ticket IDs for manual check-in
- Update account name, email, and password

### 5.4 Power Features

- Authentication & authorization
  - Sign-up, sign-in, sign-out, session-based access, protected routes, and role-based permissions
- Real-time updates
  - Socket.IO updates the event dashboard after check-in without a page refresh
- File handling and processing
  - CSV attendee files are uploaded to cloud storage, parsed on the server, validated, and converted into registrations/tickets
- Advanced state management
  - TanStack Query for server state and Redux Toolkit for shared session/ticket UI state
- External API integration
  - OpenWeather data is shown in the dashboard weather widget

### 5.5 Requirement Coverage

- Core frontend requirements are met with TypeScript, React, Tailwind CSS, reusable UI components, and responsive layouts
- Core backend requirements are implemented using TypeScript, Express, REST APIs, Prisma, SQLite, and cloud file storage
- The project uses the separate frontend and backend architecture required by Option B
- The project provides more than two advanced features: authentication and authorization, real-time updates, file processing, advanced state management, and integration with an external API

## 6. User Guide

### 6.1 Sign In and Entry

1. Use `http://localhost:5173/`. The root path will redirect you to the authentication page.
2. Use `Sign In` to log in with an existing account or `Register` to create a new account.
3. Select `Load Demo (Organizer)` if you want demo data seeded and to enter the system using the organizer account.
4. Once signed in, the system opens to the main panel. The left menu and quick navigation vary depending on the current role.

### 6.2 Organizer Flow

1. Select `Organizer Studio` from the panel menu.
2. In `Create Event`, enter the title, location, start time, and capacity and press `Create Draft Event`.
3. In `My Events`, review draft events and if needed, select an image file and press `Upload Cover`.
4. Select the event and click `Publish Event` to publish it on the public event board.
5. Go to `Staff`, select a published event, enter a staff email, and click `Assign Staff`.
6. Go to `Import Attendees`, select a published event and upload a CSV file in `name,email` format. Then click `Import CSV` to create registrations and tickets.
7. If you want to add one attendee manually, click on `Add One Attendee`. This will take you to the event `Roster` page.
8. In `Roster`, you can search the list, filter by status, add one attendee, remove attendees, and view ticket and check-in status.
9. From `My Events`, `Event Board`, or `Roster`, organizers can open `Dashboard` to view attendance statistics, or `Check-in` to enter the workflow.

### 6.3 Attendee Flow

1. Sign in using your attendee account.
2. Open `My Tickets` from the menu or quick navigation.
3. Select the ticket for the event you want to attend from the list on the left.
4. The details panel shows event info, ticket ID, and the QR code.
5. Click `Copy Ticket ID` if needed for manual check-in.
6. At the door, show the QR code to staff or provide the ticket ID for manual entry.

### 6.4 Staff Flow

1. Sign in as staff.
2. Open `Event Board`.
3. Choose an event and open one of the pages:
   - `View Roster` to see the full list
   - `Open Check-in` to verify entry
   - `Open Dashboard` to monitor attendance
4. In `Check-in`, use `Start Camera Scan` to scan a QR code.
5. If scanning is unavailable, use `Manual Entry`, paste the ticket ID, and click `Check In`.
6. The `Last Result` card shows whether the scan was accepted or marked as duplicate.
7. The `Recent Check-ins` and `Attendee Snapshot` sections help confirm the current event status.

### 6.5 Account Management

1. Click `Account` in the top bar.
2. In the dialog, update `Name` and `Email`.
3. Change the current password in the password section.
4. Click `Sign Out` in the top bar to end the session.

### 6.6 Screenshots

- Authentication page
- Organizer Studio
- Event Board
- Roster page
- Check-in page
- My Tickets page
- Event Dashboard

## 7. Development Guide

### 7.1 Environment Setup and Configuration

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env`.
4. Fill in the required environment variables before starting the backend.

For local development, the project uses SQLite by default through `prisma/schema.prisma`. A PostgreSQL example is also included in `.env.postgres.example` and `prisma/schema.postgres.prisma` for deployment.

### 7.2 Required Environment Variables

- `DATABASE_URL`
  - Local default: `file:./dev.db`
  - Deployment option: PostgreSQL connection string
- `API_PORT`
  - Local API port, usually `4000`
- `WEB_ORIGIN`
  - Allowed frontend origin for CORS and Socket.IO
  - Local default: `http://localhost:5173`
  - Deployment can use comma-separated origins
- `VITE_API_URL`
  - Frontend API base URL
  - Local default: `http://localhost:4000`
- `SPACES_REGION`
- `SPACES_ENDPOINT`
- `SPACES_BUCKET`
- `SPACES_ACCESS_KEY`
- `SPACES_SECRET_KEY`
  - These five values configure DigitalOcean Spaces, which stores event cover images and uploaded CSV files
- `OPENWEATHER_API_KEY`
  - Used by the dashboard weather card

The backend validates these variables at startup. Missing values will prevent the API server from starting.

### 7.3 Database Initialization

For local development with SQLite:

```bash
npm run db:init
```

This creates the SQLite database file if needed and runs `prisma db push` against `prisma/schema.prisma`.

If you want to use PostgreSQL for deployment, use the PostgreSQL environment template and the PostgreSQL Prisma schema included in the repository.

### 7.4 Cloud Storage Configuration

We use DigitalOcean Spaces as an S3-compatible storage service.

Cloud storage is required for:
- event cover image upload and preview
- attendee CSV upload before server-side parsing
- file download through signed URLs

Configuration steps:
1. Create a Spaces bucket.
2. Generate an access key and secret key.
3. Fill `SPACES_REGION`, `SPACES_ENDPOINT`, `SPACES_BUCKET`, `SPACES_ACCESS_KEY`, and `SPACES_SECRET_KEY` in `.env`.
4. Allow the frontend origin in the bucket CORS settings. For local development, this should match `http://localhost:5173`.
5. The bucket must allow browser upload and download for this project. In practice, the web origin should be allowed to send `PUT` and `GET` requests, and allowing `HEAD` and standard headers such as `Content-Type` is recommended.

### 7.5 Local Development

```bash
npm install
npm run db:init
npm run dev
```

Open:

```text
http://localhost:5173/
```

The combined `dev` command starts:
- the Express API on `http://localhost:4000`
- the Vite frontend on `http://localhost:5173`

Optional demo data:

```bash
npm run demo:bootstrap
```

This seeds organizer, staff, attendee, event, ticket, and check-in demo data for local testing.

### 7.6 Local Testing

```bash
npm run typecheck
npm run test
npm run test:e2e
```

These commands cover:
- TypeScript checks across the workspace
- backend tests with Vitest and Supertest
- end-to-end browser tests with Playwright

Minimal API route notes are documented in `docs/API.md`. Deployment notes are documented in `docs/DEPLOYMENT.md`.

### 7.7 Credentials

Credentials sent to TA.

## 8. Deployment Information

This project was tested locally and was not submitted with a public live deployment. No public web URL or API URL is included in this submission.

## 9. Video Demo

- Add the video link here.
- Briefly note what the video demonstrates.

## 10. AI Assistance and Verification

### 10.1 Where AI Meaningfully Contributed

AI was used for design and implementation support in areas that affected system correctness and maintainability, not just wording or formatting. The summary is based on selected milestones across the GitHub push timeline (early MVP, mid storage integration, and late hardening):

- Backend consistency hardening: evaluating approaches for duplicate registration/check-in handling under concurrency, then implementing DB constraints + transactional fallback.
- Frontend architecture cleanup: restructuring the control panel into smaller panels and unifying sidebar/quick-entry navigation from a shared config to prevent drift.
- PostgreSQL verification workflow: shaping a safe verification path that proves PostgreSQL compatibility while keeping SQLite as the default local development mode.
- Documentation alignment: refining setup/runbook notes so teammates can reproduce environment initialization, verification, and testing consistently.

### 10.2 One Representative Mistake or Limitation

A representative limitation was an early AI suggestion that relied too heavily on application-layer pre-check queries before insert for duplicate prevention. Under concurrent requests, this pattern is race-prone and can still produce duplicates.

The team identified this risk during design review and replaced it with database-enforced uniqueness plus transaction-based fallback logic. See `ai-session.md` (Session 1) for the concrete interaction and correction.

### 10.3 How Correctness Was Verified

We verified AI-assisted changes through technical checks rather than accepting suggestions directly:

- Integration tests (Vitest + Supertest), including RBAC matrix coverage and concurrent check-in consistency assertions.
- End-to-end Playwright flows for auth entry, navigation consistency, Today/Week dashboard switching, attendee ticket flow, and staff check-in real-time update behavior.
- Type and build validation (`npm run typecheck`, `npm run build`) to ensure no compile/regression issues.
- Manual flow review and log inspection for duplicate-check-in behavior and request-level error observability (`requestId`, structured error responses).

Additional prompt/response detail and per-session evidence are documented in `ai-session.md`.

## 11. Individual Contributions

The following summary is based on the current Git commit history.

### 11.1 Cunming Liu (`cunming666`)

- Created the repository and handled the initial project setup work on the main branch.
- Implemented the DigitalOcean Spaces integration on the backend, including environment configuration and presigned upload and download support.
- Extended the frontend CSV workflow so attendee CSV files are uploaded to cloud storage before import instead of being handled only as inline text.
- Added self-service password change support and related account flow updates.
- Cleaned up authentication page language and other account-facing copy during the middle stage of the project.
- Led the final workflow cleanup pass, including panel layout restructuring, organizer-managed roster flow, attendee add/remove support, account dialog updates, and final verification hardening across frontend and backend.

### 11.2 Shuanglong Zhu (`Sheltonzsl`)

- Built the initial full-stack MVP scaffold of the project, including the monorepo structure, React frontend, Express backend, shared package, Prisma schema, authentication routes, core event APIs, and the first working pages.
- Created the first runnable end-to-end version of the system, including the authentication page, control panel shell, dashboard page, demo bootstrap flow, initial integration tests, and core project documentation.
- Improved teammate setup and local startup reliability by revising environment templates, package scripts, SQLite initialization, and related setup instructions.
- Added PostgreSQL compatibility support for deployment-oriented workflows, including the PostgreSQL Prisma schema, schema sync script, verification script, smoke-check support, and related API and test adjustments.
- Added deployment-related infrastructure and documentation, including `render.yaml`, Vercel configuration, deployment runbook, and backend deployment smoke checks.
- Built the Playwright end-to-end testing setup, including browser test configuration, global setup, and the first complete e2e workflow coverage.
- Contributed a large late-stage consistency and polish pass across both frontend and backend, including API error handling, environment validation, schema updates, startup hardening, integration test expansion, panel refactoring, shared navigation cleanup, and UI refinement for the main pages.

### 11.3 Nairui Tian (`NR216`, `Nairui`)

- Worked on the core backend event flow, especially the migration from the temporary runtime store to Prisma-backed data handling.
- Implemented and stabilized the registration, check-in, duplicate check-in, and waitlist-related backend logic.
- Added staff assignment APIs and organizer-side staff assignment UI.
- Implemented the real-time attendance dashboard and related live update behavior.
- Added attendee list APIs, CSV import UI improvements, and dashboard attendee list support.
- Added Spaces-related backend configuration support where needed for the file workflow.
- Integrated the weather API feature and later introduced Redux Toolkit for advanced shared client state management across the panel and ticket flows.

### 11.4 Ruogu Xu (`29620`)

- Implemented the attendee ticket wallet and the main ticket viewing flow for attendee accounts.
- Added organizer publish workflow support and related control panel integration.
- Built the main staff check-in page and the related frontend interaction flow for QR-based and manual check-in.
- Contributed backend, schema, auth, and test updates needed to support ticket issuance, ticket display, and check-in flow integration.

## 12. Lessons Learned and Concluding Remarks

### 12.1 Cunming Liu

#### Lessons Learned

- For me, the most important thing I learned was how a full-stack team project is carried out through Git and GitHub.
- This project was also my first complete website development experience. By the end of the project, I had a much clearer understanding of how the frontend, backend, database, cloud storage, and testing workflow.

#### Concluding Remarks

- This project gave me practical experience beyond the individual assignments in the course. I was able to work on a complete event system with clear user roles and a full end-to-end workflow.

### 12.2 Shuanglong Zhu

#### Lessons Learned

- The most important lesson for me was how to turn an initially runnable MVP into a more reliable engineering system through iterative hardening. In practice, this meant improving environment setup, stabilizing startup behavior, and adding verification steps instead of only adding features.
- I learned that full-stack quality depends on clear contracts between frontend, backend, and data layers. Work such as API error normalization, Prisma schema alignment, and consistent test coverage made integration issues easier to diagnose and reduced teammate setup friction.
- I also gained practical experience balancing local developer productivity and deployment readiness, especially in maintaining SQLite as the default local flow while adding PostgreSQL verification for release confidence.

#### Concluding Remarks

- This project gave me end-to-end ownership experience across scaffolding, infrastructure, testing, and late-stage quality polishing. Compared with isolated assignments, the team workflow forced us to optimize for maintainability and reproducibility, not only correctness on one machine.
- Overall, the project strengthened my confidence in building and stabilizing full-stack systems under deadline constraints, and it showed me how much disciplined testing and documentation contribute to real project delivery.

### 12.3 Nairui Tian

#### Lessons Learned

- For me, the most important thing I learned was how backend logic connects different parts of the system, especially in features like registration, ticketing, check-in, and CSV-based attendee import.
- I also gained a better understanding of how to work with Prisma and a real database instead of relying on temporary in-memory data.

#### Concluding Remarks

- This project gave me practical experience building and improving core backend features.
- It helped me better understand how different components in a full-stack system work together in practice.

### 12.4 Ruogu Xu

- To be added by the team member.




