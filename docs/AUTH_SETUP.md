# DevSync authentication

## User flows

- `/login`: email and password sign-in, with visible links to Create account and account help.
- `/signup`: name, email, password (12–128 characters), and password confirmation. Successful signup opens a new private workspace immediately.
- `/forgot-password`: explains recovery without email. An administrator verifies the user’s identity before issuing a one-time recovery link. It does not pretend to send an email.
- `/password`: authenticated password changes, also linked from Settings.
- `/auth/signout`: clears the browser session.

Use http://127.0.0.1:3000 locally. Localhost aliases redirect to this origin. Use a stable HTTPS `NEXT_PUBLIC_APP_URL` in production.

## Supabase settings

Email authentication and public signup must be enabled; **Confirm email must be disabled** for the requested no-email signup flow. The user changed this in the hosted devsync project, and its public settings were verified as `mailer_autoconfirm: true` on 1 November 2026. Local `supabase/config.toml` matches this choice. No bulk hosted configuration push was performed.

The signup endpoint checks these settings before calling the normal Supabase `signUp` API. If confirmation is enabled again, it returns a clear setup error before creating an account or requesting an email. Password checks, duplicate-account protection, rate limiting, sessions, and user IDs remain managed by Supabase; public signup never uses the service-role admin API.

Email addresses in this mode are login identifiers, not proof of mailbox ownership. Authorization continues to use authenticated user IDs and owner-scoped RLS, never an email-domain or user-editable metadata claim.

Magic-link, resend, and emailed recovery modes remain rejected by `/auth/login`. Existing one-time confirmation/recovery handlers are retained for administrator-assisted recovery. Prepared email templates are unused and not required. No existing user’s password is silently reset or replaced.

## Verification

See `SITE_AUDIT.md` for public signup, duplicate-account protection, password sign-in, session, password-change, workspace isolation, and route verification. Disposable test accounts and their workspace records were removed after verification.
