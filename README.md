# Interview Tracker App

Personal candidate SaaS scaffold built with Next.js + TypeScript.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current scaffold

- Landing page: `/`
- Auth pages: `/auth/sign-in`, `/auth/sign-up`
- Dashboard starter: `/dashboard`
- Calendar starter: `/calendar`
- Settings starter: `/settings`
- Health API: `/api/health`
- Middleware route protection for app + API routes

## Planned implementation (next)

- Gmail OAuth (read-only) and manual sync
- Interview parsing pipeline (ICS + fallback regex)
- Stripe trial-to-paid subscription gating
- Replace temporary service-role querying with RLS-safe data access

## API scaffold available

- `GET|POST /api/applications`
- `GET|PATCH /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `POST /api/applications/:id/rounds`
- `PATCH /api/rounds/:id`
- `GET /api/subscription`

Note: these routes now use the authenticated Supabase user from session cookies.

## Database schema setup

Run `supabase/schema.sql` in your Supabase SQL editor to create required tables/types/indexes.

## Related docs

- `../interview_tracker_app_scope_technical_document.md`
- `../personal_candidate_saas_technical_scope.md`
