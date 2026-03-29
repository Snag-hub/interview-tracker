# Plan: Google OAuth Integration

This plan details the code implementation for Google OAuth signup and signin using Supabase, maintaining the professional "Showcase" theme established across the app.

## Objective
Enable users to authenticate using their Google accounts with a single click, handling the OAuth flow from request to session establishment.

## Implementation Steps

### 1. Create the Auth Callback Route
- **File:** `src/app/auth/callback/route.ts`
- **Logic:**
  - Create a GET handler to receive the auth `code` from Supabase.
  - Exchange the code for a session using `supabase.auth.exchangeCodeForSession(code)`.
  - Extract the `next` parameter from the URL to redirect the user back to their intended destination (e.g., `/settings`) or default to `/dashboard`.
  - Handle potential errors by redirecting to a sign-in error page.

### 2. Update the AuthForm Component
- **File:** `src/components/auth-form.tsx`
- **UI Changes:**
  - Add a horizontal divider with "OR" text to separate the email/password form from the social login.
  - Add a "Continue with Google" button featuring the Google G-logo.
  - Apply the "Showcase" theme styles: large rounded corners (`rounded-2xl`), bold typography, and a subtle shadow.
- **Logic:**
  - Implement `handleGoogleSignIn` which calls `supabase.auth.signInWithOAuth`.
  - Set the `redirectTo` option to point to the new callback route, including the `next` path in search parameters.

### 3. Verification & Testing
- **Session Persistence:** Ensure the Supabase session is correctly established and readable by the middleware.
- **Redirect Accuracy:** Verify that the `next` query parameter correctly guides the user after a successful login.
- **Account Linking:** Confirm that if a user already signed up with email, logging in with the same Google email links correctly (if configured in Supabase).

## Code Snippet Preview (Callback)
```typescript
const { searchParams, origin } = new URL(request.url)
const code = searchParams.get('code')
const next = searchParams.get('next') ?? '/dashboard'

if (code) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) {
    return NextResponse.redirect(`${origin}${next}`)
  }
}
```
