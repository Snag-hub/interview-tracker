# Interview Tracker - Current Status and Next Plan

## Current Build Status

- Repository is active on `master` and currently ahead of remote with local commits.
- `npm run lint` and `npm run build` are passing.
- Core app is functional end-to-end: auth -> Gmail connect -> sync -> dashboard/progress views.

## Completed (High Level)

### Platform and Security
- Next.js app scaffold and authenticated middleware protections.
- Supabase schema + RLS policy scripts in place and applied.
- Session-based API authorization for application/round/subscription APIs.

### Gmail Sync and Parsing
- Gmail OAuth connect/callback + encrypted token storage.
- Manual sync endpoint with counts/history logging.
- ICS parsing improvements with timezone-safe handling.
- Non-ICS conference capture for Teams/Google Meet/Web Conference + link checks.
- Reply-thread exclusion during sync.
- Budgeted Gemini integration with per-sync cap and saved parser resolutions.

### Product UX
- Dashboard wired to real data, grouped as one row per logical application.
- Inline sync loaders on Settings and Dashboard.
- Inline edit and delete actions for dashboard items.
- Manual interview entry form on Dashboard (button to expand form).
- Application progress page with round timeline, per-round notes/status updates, and interviewer metadata.
- Calendar wired to real interview rounds.

## Remaining Work for MVP

### 1) Data Quality and Sync Robustness
- Strengthen dedupe + reschedule/merge behavior across thread changes.
- Add parser confidence surfacing and failed-item review UI.
- Add a lightweight sync diagnostics panel (why parser/AI selected values).

### 2) Gmail Account Management
- Add Gmail disconnect action in Settings.
- Improve revoked-token recovery UX with clear reconnect path.

### 3) Data Management UI Gaps
- JD URL and resume-version management UI (create/edit/select default).
- Optional bulk actions on dashboard (merge/delete/archive selected items).

### 4) Subscription and Entitlements
- Stripe checkout endpoint.
- Stripe customer portal endpoint.
- Stripe webhook with signature validation.
- Entitlement middleware + read-only restrictions after trial.

### 5) Testing and Launch Readiness
- Unit tests for parser and validation schemas.
- API integration tests for application/round/sync flows.
- E2E smoke flow: signup -> Gmail connect -> sync -> dashboard/progress review.
- Error monitoring + structured logs.
- Deployment checklist for Vercel and production env verification.

## Proposed Next Sprint Plan

1. **Sync quality sprint**: parser confidence visibility + failed-item review + stronger dedupe/reschedule.
2. **Account UX sprint**: Gmail disconnect + token recovery messages and reconnect actions.
3. **MVP monetization sprint**: Stripe checkout/portal/webhook + entitlement guardrails.
4. **Stabilization sprint**: tests, monitoring, E2E, and deployment hardening.
