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

- Improve sync parser quality (ICS parsing + smarter company/role extraction)
- Stripe trial-to-paid subscription gating
- Dashboard calendar wiring and CRUD UI forms

## API scaffold available

- `GET|POST /api/applications`
- `GET|PATCH /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `POST /api/applications/:id/rounds`
- `PATCH /api/rounds/:id`
- `GET /api/subscription`
- `GET|POST /api/gmail/connect`
- `GET /api/gmail/callback`
- `POST /api/sync`

Note: these routes now use the authenticated Supabase user from session cookies.

## Gmail setup notes

- Configure Google OAuth credentials with redirect URI: `http://localhost:3000/api/gmail/callback`
- Add `APP_ENCRYPTION_KEY` in `.env` for token encryption at rest
- Use `/settings` to connect Gmail and trigger manual sync

## Database schema setup

Run these scripts in your Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/rls.sql`
3. `supabase/add_interviewer_metadata.sql` (if your tables already exist)

`rls.sql` enables row-level security policies, updated_at triggers, and trial subscription bootstrap on auth signup.

## Related docs

- `../interview_tracker_app_scope_technical_document.md`
- `../personal_candidate_saas_technical_scope.md`
