# API Test Cases (Automated)

Implemented in:
- `apps/api/test/api.integration.test.ts`

## 1. Auth API
- `GET /auth/session` without token returns `401`.
- `POST /auth/sign-up` creates account and returns `201`.
- Duplicate sign-up with same email returns `409`.
- `POST /auth/sign-in` returns session token.
- `GET /auth/session` with bearer token returns user profile.
- `POST /auth/sign-out` invalidates session; subsequent session check returns `401`.

## 2. Event Registration + Waitlist
- Organizer can create draft event.
- Organizer can publish event.
- Published events are visible via `GET /api/events`.
- First attendee registers as `CONFIRMED` with ticket created.
- When capacity is reached, next attendee registers as `WAITLISTED`.
- Duplicate registration attempt returns `409`.
- Attendee cannot access organizer/staff attendees endpoint (`403`).
- When confirmed attendee cancels, waitlisted attendee is promoted to `CONFIRMED`.

## 3. Check-in Idempotency + RBAC
- Staff assigned to event can check in ticket manually.
- First check-in marks `isDuplicate = false`.
- Second check-in on same ticket marks `isDuplicate = true`.
- Attendee role cannot call check-in endpoints (`403`).
- Dashboard checked-in count excludes duplicates.
