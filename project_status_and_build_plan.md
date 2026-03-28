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

### 5) RLS and Security Baseline (Completed)
- Added RLS policy script: `supabase/rls.sql`
- Added ownership policies for subscriptions, gmail_accounts, applications, rounds, resume_versions, and sync_runs
- Added `updated_at` trigger function and triggers for mutable tables
- Added signup trigger to auto-create trial subscription rows in `subscriptions`
- API routes now use session-based Supabase server client (anon key + auth cookie), not service-role querying

### 6) API Scaffold (Implemented)
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id`
- `PATCH /api/applications/:id/status`
- `POST /api/applications/:id/rounds`
- `PATCH /api/rounds/:id`
- `GET /api/subscription`

### 7) Gmail OAuth + Manual Sync Foundation (Completed)
- Added Gmail OAuth connect endpoint: `GET|POST /api/gmail/connect`
- Added OAuth callback endpoint: `GET /api/gmail/callback`
- Added encrypted token storage in `gmail_accounts`
- Added manual sync endpoint: `POST /api/sync`
- Added basic parsing and upsert flow into `job_applications` and `interview_rounds`
- Settings page now supports Gmail connect and manual sync trigger

## What Still Needs To Be Built

## Phase 2 - Database and Security Hardening
- Run `supabase/schema.sql` and `supabase/rls.sql` in Supabase project
- Validate RLS behavior for all read/write APIs in authenticated session
- Add seed/dev bootstrap script for local testing

## Phase 3 - Gmail Integration
- Add Gmail account disconnect flow in settings
- Improve token refresh and revoked token recovery UX
- Add richer sync result feedback in UI

## Phase 4 - Sync and Parsing Engine
- Parse `.ics` invites first (DTSTART, DTEND, SUMMARY, LOCATION)
- Improve regex and subject parsing quality
- Add stronger dedupe/reschedule logic
- Add parser confidence and failed-item review

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

1. Add ICS attachment parser and timezone-safe date extraction.
2. Add sync result UI feedback and sync history panel.
3. Add Stripe checkout/portal/webhook flow.
4. Add dashboard forms for application and round CRUD.
