## AI Interaction Record (Representative Sessions)

This file records three representative AI-assisted sessions selected from the GitHub push timeline (`origin/main`, from `efa190a` on 2026-02-27 to `589f249` on 2026-03-30). We intentionally selected high-impact technical interactions rather than trivial wording edits.

Timeline anchors (selected milestones):
- `2a48f94` (2026-03-05): initial MVP scaffold
- `5fedc2c` (2026-03-14): migrate runtime store to Prisma
- `3933d00` / `b072280` / `a1eaef5` (2026-03-16~17): Spaces integration + CSV upload flow
- `8326604` / `a8dafe3` / `db93acc` (2026-03-25~27): PostgreSQL verification, E2E, consistency hardening
- `2222cee` (2026-03-28): panel workflow streamlining and verification hardening

## Session 1: Early architecture and data model direction (MVP -> Prisma)

### Prompt (you sent to AI)

We are starting from an empty repository for an event check-in system. Propose a practical full-stack structure (React + Express + TypeScript), initial API boundaries, and a migration path from quick MVP storage to a relational DB model.

### AI Response (trimmed if long)

- Suggested monorepo layout with `apps/web`, `apps/api`, `packages/shared`.
- Suggested role-aware API boundaries for Organizer / Staff / Attendee.
- Suggested starting with a fast MVP path, then moving to Prisma models and relational constraints.

### What Your Team Did With It

- Useful: We adopted the monorepo + shared-types structure and role-oriented API contracts.
- Incorrect, misleading, or not applicable: Early AI drafts were too tolerant of keeping temporary in-memory logic for too long; we considered this risky for consistency and switched to Prisma-backed persistence earlier.
- Verification: We validated the migration by exercising end-to-end registration/check-in/waitlist flows after Prisma integration, and by adding backend integration tests.

## Session 2: Cloud storage + CSV import workflow design

### Prompt (you sent to AI)

We must satisfy cloud file handling requirements. Should attendee CSV be uploaded to object storage first and then imported, or posted directly as form text? We need an implementation that is reproducible and aligned with course requirements.

### AI Response (trimmed if long)

- Suggested presigned upload/download flow for S3-compatible storage.
- Suggested tracking uploaded files in DB metadata and linking them to import jobs.
- Suggested validating CSV rows and returning import summaries (success/duplicate/invalid counts).

### What Your Team Did With It

- Useful: We implemented DigitalOcean Spaces presigned file workflow and attached CSV import processing + summary reporting.
- Incorrect, misleading, or not applicable: One AI variant proposed keeping CSV as direct inline text only; we rejected this because it weakens cloud-storage evidence and reproducibility for our project goals.
- Verification: We verified upload/import/download paths with API integration tests and manual organizer flow checks.

## Session 3: Release hardening (concurrency, PostgreSQL verification, UI regression safety)

### Prompt (you sent to AI)

Before final delivery, we need to harden duplicate prevention under concurrency, keep SQLite local dev while proving PostgreSQL compatibility, and prevent frontend dashboard regressions. Propose a low-risk verification plan.

### AI Response (trimmed if long)

- Suggested DB-level uniqueness + transactional fallback for check-in idempotency.
- Suggested scripted PostgreSQL verification pipeline without permanently switching local default DB.
- Suggested adding E2E guards for key dashboard interactions (navigation consistency, time-range switching, real-time flow).

### What Your Team Did With It

- Useful: We implemented uniqueness/transaction guards, PostgreSQL verification scripts, and Playwright regression tests for dashboard and auth flows.
- Incorrect, misleading, or not applicable: Early AI logic over-relied on application pre-checks before insert in concurrent paths. We replaced it with DB-enforced constraints and fallback handling to avoid race-condition duplicates.
- Verification: We used `npm run typecheck`, `npm run build`, backend integration tests (including RBAC and concurrency), E2E tests, and runtime log checks for duplicate check-in behavior.
