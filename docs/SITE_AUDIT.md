# DevSync site audit — 1 November 2026

## Fixed

1. Restored a dedicated `/signup` page and public signup endpoint. Login has prominent Sign in / Create account navigation. New accounts start a session and open their private workspace without email.
2. Added `/forgot-password` with truthful recovery guidance for the no-email setup; removed obsolete instructions to request login emails from recovery screens.
3. Unauthenticated account-selection visits now return to login. Integration setup and OAuth failures now reach a readable recovery page instead of raw JSON.
4. Empty work-item, PR, repository, and sprint views offer links to Connections instead of ineffective filter clearing or text-only instructions.
5. Scope selection clears stale resource lists, limits selection to 20, prevents overlapping requests, and times out stalled fetches. Connection and settings mutations have bounded waits and clearer errors.
6. Workspace renaming bootstraps the caller’s workspace and verifies an actual row was updated, rather than returning success on zero rows.
7. Onboarding remains visible when a connection is unhealthy or has no selected resources/import.
8. Unconfigured live routes no longer silently display demo data.

## Verified

- 75 tests across 11 files, including signup validation, duplicate-account errors, origin rejection, no-email configuration guards, server-rendered account pages, and nine dashboard views.
- Strict TypeScript and webpack production build passed.
- Public signup on the hosted Supabase project returned HTTP 201, session cookies, and an authenticated new workspace. No email was sent.
- Duplicate signup returned 409 and did not overwrite the original password. Wrong-password login returned 401; the original password still signed in.
- All nine live routes require authentication; all nine demo routes render. Next.js streamed redirects/not-found responses are checked by their redirect/error markers as well as status codes.
- All nine live views render for a fresh account without sample records leaking into its workspace.
- Workspace rename works before the first overview visit. Missing connections return 404; syncing an unconnected workspace returns a useful 400.
- Anonymous mutation requests return 401, cross-origin login returns 403, and unsigned GitHub/Jira webhooks return 401.
- Two disposable users exercised live RLS: one could neither read nor update the other’s workspace. Authenticated users could not call the worker queue RPC.
- Password changes, sign-out cookie clearing, protection after sign-out, and subsequent sign-in with the new password passed.
- `npm audit --omit=dev`: zero reported production dependency vulnerabilities.
- Three disposable test accounts (one public signup, two audit fixtures) and their cascading workspace records were removed.

## Limits

The browser policy rejected local preview access because of a saved permission for `http://127.0.0.1:3000`. No browser workaround was used. Desktop/mobile visual layout, clicks, focus behavior, and the saved Playwright scenarios remain unverified in this pass. The source/render/HTTP checks above are not a substitute for those checks.

Full GitHub/Jira consent and live imports were not run against the user’s accounts. Hosted schema advisors and SQL checks were unavailable through the connector; the live isolation checks above used normal authenticated Data API calls. This is a scoped product audit, not a claim that the app is production-certified or free of every defect.

# Follow-up audit — 1 November 2026 (evening)

The local preview now opens in the browser, so this pass covered the visual and interaction checks the earlier audit could not.

## Fixed

1. **Production build was failing.** `npm run build` stopped on a TypeScript error in `api/connect/[provider]/select` (Jira site URL typed as optional). `jiraSites` now narrows the type.
2. **Dashboard routes returned HTTP 200 for redirects and 404s.** `loading.tsx` starts streaming before the page runs, so signed-out visitors got a 200 page with a one-second meta refresh, and unknown paths (`/nope/deeper`) returned 200. A segment layout now validates the view and the session before streaming starts: signed-out visits get a 307 to `/login`, and unknown paths get a real 404. The user lookup is cached per request, so this adds no extra Supabase call.
3. **Account-selection errors showed raw JSON.** Failures in the GitHub installation / Jira site form POST, and stale or invalid pending authorizations on `/connect/[provider]`, now land on the readable `/connect/error` page (303 so the browser switches to GET).
4. **Sign-in button overlapped "New to DevSync? Create account".** That line reused a helper class with a negative top margin. It now has its own spacing. The mobile login header is now full width.
5. **Settings layout.** "Change password" was jammed above the Workspace details heading. It now has its own Account section.
6. **Client error messages.** Every client request parsed JSON unconditionally and threw `body.error`. A proxy/HTML error showed "Unexpected token '<'", and a missing message showed an empty toast. All seven call sites now fall back to a clear message.
7. **GitHub import scalability.** The importer listed every PR in a repository's history (failing above 10,000 PRs) before keeping the last 90 days. It now lists open PRs, then stops paging closed PRs at the 90-day cutoff. The 1,000-PR cap is checked before the per-PR detail requests. A single PR with more than 250 commits or 3,000 files (GitHub's listing limits) no longer fails the whole connection's sync. Duplicate repository-list calls were removed.
8. **Worker filter.** The stale-failure guard now quotes its timestamp in the PostgREST `or` filter; both forms were checked against the hosted API.
9. **E2E suite.** One assertion expected lowercase "failing" while the UI shows "Failing". Fixed; all three Playwright scenarios pass.

## Verified

- `npm run typecheck`, `npm test` (76 tests, 11 files), and `npm run build` pass.
- Playwright: 3/3 pass (search and detail traversal, PR filters and evidence, mobile overflow).
- Browser: all nine demo views at desktop width; login, signup and pull requests at 375px with no horizontal page overflow.
- Live, against hosted Supabase with a disposable account: signup (201), all nine live views, onboarding, empty-workspace refresh message, workspace rename, password page, sign-out and post-sign-out protection, GitHub and Jira OAuth authorize redirects (correct callback URLs and scopes), forged callback state, missing pending authorization, cross-origin rejection (403), and unknown connection (404).
- The queue worker starts, polls the hosted queue without errors, and stops cleanly on SIGINT.
- The disposable account and its workspace were deleted afterward.

## Still not verified

Full GitHub/Jira consent and real imports need the account owner to authorize the provider apps. Webhook delivery needs a public HTTPS origin. `npm run test:db` was not rerun.
