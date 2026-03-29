# Event Ticketing & QR Check-In System

A full-stack event management system for publishing events, managing attendees, issuing tickets, and handling on-site check-in.

## Submission Checklist

- [Done] Final report structure prepared in `README.md`
- [Done] Complete source code included in the repository
- [Done] Development guide written for local setup and testing
- [Done] Individual contributions drafted from commit history
- [Todo] Fill student numbers and preferred email addresses in Section 1
- [Todo] Add screenshots in Section 6
- [Todo] Add the video demo link in Section 9
- [Todo] Complete Section 10: AI Assistance and Verification
- [Todo] Add `ai-session.md`
- [Todo] Let each team member review and revise their own contribution or reflection sections if needed
- [Todo] Final proofreading and submission

## 1. Team Information

| Name | Student Number | Preferred Email |
| --- | --- | --- |
| Shuanglong Zhu |  |  |
| Nairui Tian |  |  |
| Cunming Liu |  |  |
| Ruogu Xu |  |  |

## 2. Motivation

Small events often rely on spreadsheets, chat tools, and manual lists for registration and check-in. That works for very small groups, but it becomes inefficient when attendance grows. Organizers may lose track of who is registered, staff may check people in against outdated lists, and parallel check-in can create confusion.

We chose this project because it is a common campus workflow and a good fit for a full-stack system. It requires frontend and backend integration, database design, access control, file handling, and real-time updates. Our goal was to replace scattered tools with one clear workflow.

The project is meant to give organizers, staff, and attendees a single system for event operations. Organizers manage events and rosters, staff handle entry, and attendees access their tickets. This keeps the process simpler and more reliable.

## 3. Objectives

The main objective was to build a complete event ticketing and check-in system for small events. The system is not just an event information page. It is designed to support the full workflow from event creation to final entry verification.

Our team aimed to:

- build a separated React frontend and Express backend
- support organizer, staff, and attendee roles with different permissions
- let organizers create and publish events, manage rosters, assign staff, and monitor attendance
- let attendees view their assigned tickets
- let staff complete QR or manual check-in on site
- keep event, ticket, and check-in data consistent in the database
- support event cover uploads and CSV attendee import through cloud storage
- provide live attendance updates during check-in

In short, the goal was to build a clear and usable system that covers the core event workflow and satisfies the technical requirements of the course project.

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

- DigitalOcean Spaces as S3-compatible object storage
- AWS SDK v3 and pre-signed upload/download URLs for file transfer
- Event cover images and attendee CSV files are stored in cloud object storage
- OpenWeather API is used for the weather widget in the dashboard

### 4.5 Project Structure and Testing

- npm workspaces for the monorepo structure: `apps/web`, `apps/api`, and `packages/shared`
- `@checkin/shared` for shared types and common contracts
- `concurrently` for running frontend and backend together in development
- Vitest and Supertest for backend tests
- Playwright for end-to-end browser tests

## 5. Features

### 5.1 Organizer Features

- Create draft events with title, location, time, and capacity
- Upload event cover images through cloud storage
- Publish events to the event board
- Assign and remove staff for each event
- Import attendees from CSV files
- Add or remove individual attendees in the roster page
- View event roster, attendance status, and live dashboard data

### 5.2 Staff Features

- Open assigned events from the event board
- View the full event roster
- Check attendees in by QR scan
- Check attendees in manually by ticket ID
- View recent check-ins and attendance progress during the event

### 5.3 Attendee Features

- Register and sign in to the system
- View assigned tickets in the ticket page
- Open a QR code for each active ticket
- Copy ticket IDs for manual check-in
- Update account name, email, and password

### 5.4 Advanced Features

- Authentication and authorization
  - Sign-up, sign-in, sign-out, session-based access, protected routes, and role-based permissions
- Real-time updates
  - Socket.IO updates the event dashboard after check-in without a page refresh
- File handling and processing
  - CSV attendee files are uploaded to cloud storage, parsed on the server, validated, and converted into registrations and tickets
- Advanced state management
  - TanStack Query handles server state, and Redux Toolkit stores shared session and ticket UI state
- External API integration
  - OpenWeather data is shown in the dashboard weather widget

### 5.5 Requirement Coverage

- Core frontend requirements are met with TypeScript, React, Tailwind CSS, reusable UI components, and responsive layouts
- Core backend requirements are met with TypeScript, Express, REST APIs, Prisma, SQLite, and cloud file storage
- The project uses the separate frontend and backend architecture required by Option B
- The project implements more than two advanced features: authentication and authorization, real-time updates, file processing, advanced state management, and external API integration

## 6. User Guide

### 6.1 Sign In and Entry

1. Open `http://localhost:5173/`. The root path redirects to the authentication page.
2. Use `Sign In` to log in with an existing account, or use `Register` to create a new account.
3. Use `Load Demo (Organizer)` if you want to seed demo data and enter the system with the organizer account.
4. After sign-in, the system opens the main panel. The left menu and quick navigation change based on the current role.

### 6.2 Organizer Flow

1. Open `Organizer Studio` from the panel menu.
2. In `Create Event`, enter the title, location, start time, and capacity, then click `Create Draft Event`.
3. In `My Events`, review draft events. If needed, choose an image file and click `Upload Cover`.
4. Click `Publish Event` to move the event from draft to the public event board.
5. In `Staff`, select a published event, enter a staff email, and click `Assign Staff`.
6. In `Import Attendees`, select a published event and upload a CSV file in `name,email` format. Click `Import CSV` to create registrations and tickets.
7. If you want to add one attendee manually, open `Add One Attendee`, which leads to the event `Roster` page.
8. In `Roster`, organizers can search the list, filter by status, add one attendee, remove attendees, and view ticket and check-in status.
9. From `My Events`, `Event Board`, or `Roster`, organizers can open `Dashboard` to view attendance statistics or `Check-in` to access the entry workflow.

### 6.3 Attendee Flow

1. Sign in with an attendee account.
2. Open `My Tickets` from the menu or quick navigation.
3. Select a ticket from the ticket list on the left side.
4. The details panel shows the event information, ticket ID, and QR code for the selected ticket.
5. The attendee can click `Copy Ticket ID` if manual check-in is needed.
6. At the event entrance, the attendee shows the QR code to staff, or gives the ticket ID for manual entry.

### 6.4 Staff Flow

1. Sign in with a staff account.
2. Open `Event Board`.
3. Choose an event and open one of the event pages:
   - `View Roster` to see the full attendee list
   - `Open Check-in` to start entry verification
   - `Open Dashboard` to monitor attendance
4. In `Check-in`, use `Start Camera Scan` to scan a QR code with the browser camera.
5. If scanning is unavailable, use `Manual Entry`, paste the ticket ID, and click `Check In`.
6. The `Last Result` card shows whether the scan was accepted or marked as a duplicate.
7. The `Recent Check-ins` and `Attendee Snapshot` sections help staff confirm the current event status.

### 6.5 Account Management

1. Click `Account` in the top bar.
2. In the account dialog, update `Name` and `Email` in the profile section if needed.
3. Use the password section to change the current password.
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

This script creates the SQLite database file if needed and runs `prisma db push` against `prisma/schema.prisma`.

If you want to use PostgreSQL for deployment, use the PostgreSQL environment template and the PostgreSQL Prisma schema included in the repository.

### 7.4 Cloud Storage Configuration

The project uses DigitalOcean Spaces as S3-compatible object storage.

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

- Summarize where AI was used in a technically meaningful way.

### 10.2 One Representative Mistake or Limitation

- Briefly describe one incorrect, incomplete, or suboptimal AI output.
- Refer to `ai-session.md` for the concrete interaction record.

### 10.3 How Correctness Was Verified

- Summarize how your team verified AI-assisted work through testing, logs, manual flow checks, or code review.

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

- To be added by the team member.

### 12.3 Nairui Tian

- To be added by the team member.

### 12.4 Ruogu Xu

- To be added by the team member.
