# Demo Playbook (Directly Usable)

## 1) Start services
```bash
npm install
npm run dev
```

## 2) Seed demo data + get test accounts
Open a second terminal:
```bash
npm run demo:bootstrap
```

This command calls:
- `POST /api/demo/bootstrap`

and prints:
- seeded event ID
- ready-to-use test accounts
- bearer tokens (for API testing tools like Postman)

## 3) Default test accounts
After bootstrap, these accounts are always available:
- `organizer.demo@utoronto.ca` / `pass1234`
- `staff.demo@utoronto.ca` / `pass1234`
- `attendee1.demo@utoronto.ca` / `pass1234`
- `attendee2.demo@utoronto.ca` / `pass1234`
- `attendee3.demo@utoronto.ca` / `pass1234`

## 4) Quick UI demo flow
1. Open `http://localhost:5173`
2. Sign in with organizer account
3. Open the seeded event dashboard (from event board)
4. Sign in with staff account and perform check-in action through API or UI workflow
5. Refresh dashboard to show live counters

## 5) Direct API demo cases

Use the token returned by `npm run demo:bootstrap`:
```http
Authorization: Bearer <TOKEN>
```

### Case A: Duplicate check-in
- Use STAFF token.
- Call `POST /api/checkins/manual` with `ticketId = firstTicketId` from bootstrap output.
- Expected:
  - first call: `isDuplicate=false`
  - second call: `isDuplicate=true`

### Case B: Waitlist promotion
- Use ATTENDEE 1 token.
- Call `DELETE /api/events/:eventId/register`
- Expected:
  - attendee3 promoted from `WAITLISTED` to `CONFIRMED`

### Case C: Dashboard verification
- Use ORGANIZER or STAFF token.
- Call `GET /api/events/:eventId/dashboard`
- Expected:
  - `checkedIn` excludes duplicates
  - recent check-ins list updates
