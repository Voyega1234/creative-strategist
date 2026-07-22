# Supabase passwordless authentication setup

The application code is configured for passwordless email-link sign-in and only accepts `@convertcake.com` sessions. Complete these one-time Supabase project settings before deploying.

Application pages and API routes require a valid company session. Existing public share links remain accessible, as do the share-page Facebook mockup endpoint and the n8n idea-generation callback.

## 1. Apply the domain-restriction hook

Run `db/migrations/restrict_auth_to_convertcake.sql` in the Supabase SQL Editor (or through your normal migration workflow).

Then open **Authentication > Hooks**, enable **Before User Created**, select the Postgres function `public.restrict_auth_to_convertcake`, and save. This makes Supabase reject non-company users even if someone calls the Auth API outside this application.

## 2. Configure email authentication

In **Authentication > Sign In / Providers > Email**:

- Enable the Email provider.
- Enable new user signups if every `@convertcake.com` employee should be able to create an account from the login page.
- Keep the Magic Link email template using `{{ .ConfirmationURL }}`.

For production email delivery, configure **Authentication > Email > SMTP Settings**. Supabase's default mail service is intended only for testing and only sends to pre-authorized team addresses.

## 3. Configure redirect URLs

In **Authentication > URL Configuration**:

- Set **Site URL** to the production application URL.
- Add `http://localhost:3000/auth/callback` for local development.
- Add `https://YOUR_PRODUCTION_DOMAIN/auth/callback` for production.
- Add the matching preview URL pattern if preview deployments need login access.

No password environment variable is used by the new authentication flow. The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables are required.
