# Interview Tracker - Project Status and Build Plan

## Current Repository Setup

- Git remote `origin` added: `https://github.com/Snag-hub/interview-tracker.git`
- Next.js TypeScript project initialized in `interview-tracker-app`
- Lint and production build pass successfully

## What Is Already Built

### 1) App Scaffold
- Landing page and starter UX implemented
- Starter pages created:
  - `/dashboard`
  - `/calendar`
  - `/settings`
- Health route created:
  - `GET /api/health`

### 2) Core Frontend Foundation
- Global app theme and typography updated
- Domain constants added for statuses and stages

### 3) Supabase and API Foundation
- Supabase schema file created: `supabase/schema.sql`
- Environment template created: `.env.example`
- Supabase admin client helper added
- Validation with Zod added for API payloads

### 4) Auth and Access Control Foundation (Completed)
- Supabase Auth UI pages added:
  - `/auth/sign-in`
  - `/auth/sign-up`
- Sign-out route added:
  - `/auth/sign-out`
- Middleware protection added for:
  - app pages (`/dashboard`, `/calendar`, `/settings`)
  - core APIs (`/api/applications*`, `/api/rounds*`, `/api/subscription`)
- API routes now resolve authenticated session user instead of `DEV_USER_ID`

### 5) API Scaffold (Implemented)
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `POST /api/applications/:id/rounds`
- `PATCH /api/rounds/:id`
- `GET /api/subscription`

## What Still Needs To Be Built

## Phase 2 - Database and Security Hardening
- Run `supabase/schema.sql` in Supabase project
- Add Row Level Security (RLS) policies for each table
- Add `updated_at` trigger function for consistency
- Add seed/dev bootstrap script for local testing

## Phase 3 - Gmail Integration
- Implement Google OAuth connect endpoint
- Implement callback endpoint and secure token persistence
- Add Gmail account connect/disconnect status in settings
- Add token refresh handling and revocation handling

## Phase 4 - Sync and Parsing Engine
- Implement `POST /api/sync`
- Add Gmail fetch using query filters and incremental sync strategy
- Parse `.ics` invites first (DTSTART, DTEND, SUMMARY, LOCATION)
- Add regex fallback for meeting links and round classification
- Add dedupe and reschedule logic
- Log sync results in `sync_runs`

## Phase 5 - Product Features for MVP
- Dashboard data wiring to real APIs
- Calendar data wiring to real APIs
- Application detail page with rounds timeline
- Status transitions and manual edit flows
- JD URL and resume-version URL management UI

## Phase 6 - Subscription and Paywall
- Stripe checkout session endpoint
- Stripe customer portal endpoint
- Stripe webhook endpoint with signature verification
- Entitlement middleware (`trialing|active` full access)
- Read-only restrictions after trial expiration

## Phase 7 - Testing and Launch Readiness
- Unit tests for parsers and payload validators
- API integration tests for main endpoints
- End-to-end smoke flow:
  - signup -> connect Gmail -> sync -> view dashboard
- Error monitoring and structured logging
- Deployment to Vercel + environment variable checklist

## Suggested Immediate Next Steps

1. Configure Supabase project and run `supabase/schema.sql`.
2. Add RLS policies and remove dependency on service-role querying in application APIs.
3. Build Gmail OAuth connect/callback endpoints.
4. Implement `POST /api/sync` with ICS-first parsing.
