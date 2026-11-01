# Verification record

Date: 1 November 2026. Updated after the product and reliability improvements.

Current changes do not alter the hosted database schema. Supabase project, migration, and database-isolation results below are from the initial setup; they were not rerun in this improvement pass. The Supabase connector denied the advisory calls, so there is no new hosted advisory or live-import result.

| Check                                                 | Result                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Strict TypeScript, including unused locals/parameters | Passed                                                                                                |
| Domain, provider, crypto and source-import tests      | 75 passed across 11 files (includes server rendering and HTTP boundary tests)                         |
| Production Next.js build                              | Passed with webpack                                                                                   |
| Supabase project creation                             | `devsync`, Mumbai, `anjfnzzdkjuwzpebxwus`                                                             |
| Database migrations                                   | All 3 applied successfully                                                                            |
| Generated database types                              | Generated from the linked public schema                                                               |
| Transactional database isolation/integrity checks     | Passed; fixtures rolled back                                                                          |
| Scheduled reconciliation                              | Active, every 10 minutes                                                                              |
| Worker queue API                                      | Final connectivity probe succeeded; queue empty                                                       |
| Local secret file permissions                         | `.env.local` mode 600                                                                                 |
| Source credential scan                                | No matching secret-key/JWT patterns found in source, docs, migrations, tests or lockfile              |
| Initial browser review                                | Demo rendered and screenshot inspected; an initial locale-dependent hydration attribute was corrected |
| Final desktop/mobile visual review                    | Attempted after fresh user approval; blocked by a saved browser permission for http://127.0.0.1:3000  |
| Saved Playwright scenarios                            | Authored, not run in this session                                                                     |
| Live GitHub/Jira imports and OAuth flows              | Full authorized provider flows not verified during this authentication pass                          |
| Production deployment                                 | Not performed                                                                                         |

## Database checks exercised

- A user sees only their workspace, connections and imported work.
- Anonymous users cannot read imported records.
- Import data and source metadata become unreadable after the access freshness limit.
- Browser users cannot read encrypted worker credentials or write imported records.
- Workspace ownership cannot be reassigned by changing allowed profile fields.
- Database constraints reject cross-workspace source relationships.
- Repeated webhook delivery IDs enqueue once.
- Repeated snapshots do not duplicate imported records.
- Imports from an outdated scope generation cannot publish.
- Snapshot reconciliation removes activity events no longer present in the authorized source snapshot.

The worker logged intermittent connectivity errors during the extended session and retried without exposing credentials. A final direct worker-queue API probe succeeded. No long-running availability claim is made from this local check.

## Improvement regression checks

- All nine workspace views render with valid values, including an empty live workspace.
- Overview rendering stays identical when client/server clocks differ but the snapshot is unchanged.
- Shared work-item links do not inflate PR coverage; hidden and duplicate edges are excluded.
- Unknown checks never qualify a PR as approved-and-passing; failing unlinked PRs still produce signals.
- Status-drift evidence is retained separately for multiple work items sharing a PR.
- Exact 30-minute source freshness boundaries match the existing access cutoff.
- Exported briefs identify sample data and escape source-provided Markdown.
- Retry-After supports seconds and HTTP dates, falls back to reset headers, and cannot create a NaN queue delay.
- Expired provider budgets abort their own requests without leaking cancellation into another job.
- Chunked body limits count UTF-8 bytes and cancel oversized streams; invalid JSON/media return 400/415.
- Source links reject script/data/HTTP schemes and embedded credentials.

Use the README commands to restart the app and worker when needed. Browser, OAuth, and provider-integration validation remain explicit follow-up requirements before production rollout.

Authentication was additionally tested against hosted Supabase through the local HTTP routes using disposable accounts. Password sign-in, protected workspace rendering, password update, sign-out, unauthenticated denial, one-time email-token verification, and token replay rejection passed. Fixture accounts were deleted afterward. The latest public signup, session, and cross-workspace checks are recorded in `SITE_AUDIT.md`. Email templates are not needed for password-only signup.

The localhost alias returns an absolute 307 redirect to the configured 127.0.0.1 origin, preserves query parameters, and finishes at HTTP 200 without a redirect loop. This uses configuration redirects because Next.js relativizes Proxy redirects against the server bind address.
