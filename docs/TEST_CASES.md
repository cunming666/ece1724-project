# API and E2E Test Cases

## API Integration Tests (Automated)

Implemented in:
- `apps/api/test/api.integration.test.ts`

### 1. Auth API
- `GET /auth/session` without token returns `401`.
- `POST /auth/sign-up` creates account and returns `201`.
- Duplicate sign-up with same email returns `409`.
- `POST /auth/sign-in` returns session token.
- `GET /auth/session` with bearer token returns user profile.
- `POST /auth/sign-out` invalidates session; subsequent session check returns `401`.

### 2. Event Registration + Waitlist
- Organizer can create draft event.
- Organizer can publish event.
- Published events are visible via `GET /api/events`.
- First attendee registers as `CONFIRMED` with ticket created.
- When capacity is reached, next attendee registers as `WAITLISTED`.
- Duplicate registration attempt returns `409`.
- Attendee cannot access organizer/staff attendees endpoint (`403`).
- When confirmed attendee cancels, waitlisted attendee is promoted to `CONFIRMED`.

### 3. Check-in Idempotency + RBAC
- Staff assigned to event can check in ticket manually.
- First check-in marks `isDuplicate = false`.
- Second check-in on same ticket marks `isDuplicate = true`.
- Attendee role cannot call check-in endpoints (`403`).
- Dashboard checked-in count excludes duplicates.

## UI E2E Tests (Playwright)

Implemented in:
- `tests/e2e/app.e2e.spec.ts`

### 1. Auth flow
- Sign up a new attendee account from `/auth`.
- Sign in and enter `/panel`.
- Sign out and return to `/auth`.
- Use `Quick Start Demo` and verify organizer session enters control panel.

### 2. Attendee registration -> ticket QR flow
- Seed demo data via `/api/demo/bootstrap`.
- Organizer creates and publishes a dedicated E2E event.
- New attendee signs up and registers from published event board.
- Attendee opens `My Tickets` and sees ticket/QR section.

### 3. Staff check-in -> dashboard realtime flow
- Seed demo data and create a dedicated event.
- Register one attendee ticket for that event.
- Open organizer dashboard and staff check-in pages in separate browser contexts.
- Submit manual check-in on staff page.
- Verify organizer dashboard `Checked In` count updates in near real-time.
