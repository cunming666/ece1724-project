# API Notes (Minimal)

## Health
- `GET /health`
- `POST /api/demo/bootstrap` (development-only demo seed)

## Auth
- `POST /auth/sign-up`
- `POST /auth/sign-in`
- `POST /auth/sign-out`
- `GET /auth/session`

## Events
- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:eventId`
- `PATCH /api/events/:eventId`
- `PATCH /api/events/:eventId` supports `coverFileId` for event cover binding.
- `POST /api/events/:eventId/publish`
- `POST /api/events/:eventId/register`
- `DELETE /api/events/:eventId/register`
- `GET /api/events/:eventId/attendees`
- `GET /api/events/:eventId/dashboard`

## Tickets & Check-in
- `GET /api/tickets/:ticketId/qr`
- `POST /api/checkins/scan`
- `POST /api/checkins/manual`

## Files and CSV Import
- `POST /api/files/presign-upload`
- `POST /api/events/:eventId/import-attendees-csv`
- `GET /api/events/:eventId/import-jobs`
- `GET /api/files/:fileId/download`
