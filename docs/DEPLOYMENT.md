# Deployment Runbook (Vercel + Render + Neon + Spaces)

This runbook gives a reproducible production deployment for the event check-in system.

## 0. Target Architecture

- Frontend: Vercel static deployment from `apps/web`
- Backend: Render Web Service from `apps/api`
- Database: Neon PostgreSQL
- Object storage: DigitalOcean Spaces (S3 compatible)

## 1. Prerequisites

- GitHub repo with latest `main`
- Neon project and PostgreSQL connection string
- DigitalOcean Spaces bucket + access key + secret key
- OpenWeather API key (optional but recommended for dashboard weather card)

## 2. Deploy Backend on Render (Blueprint)

The repository includes `render.yaml` for one-click service setup.

1. Open Render dashboard.
2. Click **New +** -> **Blueprint**.
3. Select this GitHub repo and branch `main`.
4. Confirm blueprint creation.

Render will create service `ece1724-checkin-api` with:
- Build Command: `npm install && npm run build`
- Start Command: `npm run start -w @checkin/api`
- Health Check: `/health`

5. In service settings, set env vars:
- `DATABASE_URL` = Neon PostgreSQL URL
- `WEB_ORIGIN` = temporary `http://localhost:5173` (replace after Vercel is ready)
- `SPACES_REGION`
- `SPACES_ENDPOINT`
- `SPACES_BUCKET`
- `SPACES_ACCESS_KEY`
- `SPACES_SECRET_KEY`
- `OPENWEATHER_API_KEY`

6. Trigger a deploy and confirm health endpoint is green.

## 3. Verify PostgreSQL Schema Against Neon

From local machine (once), run:

```bash
npm run verify:postgres
```

This validates Prisma client generation, schema push, and a CRUD smoke check.

## 4. Deploy Frontend on Vercel

1. Open Vercel dashboard.
2. Import the same GitHub repo.
3. Set **Root Directory** to `apps/web`.
4. Set environment variable:
- `VITE_API_URL` = Render API URL (for example `https://ece1724-checkin-api.onrender.com`)

5. Deploy.

## 5. Finalize CORS/Socket Origin on Render

After Vercel deploy, copy web domain(s), then update Render env var:

- `WEB_ORIGIN` = comma-separated allowed origins
- Example:
  `https://your-app.vercel.app,https://your-app-git-main.vercel.app`

Redeploy backend after updating `WEB_ORIGIN`.

## 6. Post-Deploy Smoke Check

Run from local with your real domains:

```bash
API_DEPLOY_URL="https://<your-api-domain>" WEB_DEPLOY_URL="https://<your-web-domain>" npm run smoke:deploy
```

Expected output:
- API health ok
- `/api/events` reachable
- CORS preflight accepted
- Web root reachable

## 7. Rollback Plan

1. Backend rollback (Render): redeploy previous successful commit.
2. Frontend rollback (Vercel): promote previous successful deployment.
3. If DB schema issues appear, revert code and redeploy backend first.

## 8. Demo-Ready Checklist

- Organizer can log in and open control panel
- Attendee can register and view QR ticket
- Staff can check in via manual/scan
- Dashboard updates via Socket.IO in near real-time
- File upload/download endpoints work
