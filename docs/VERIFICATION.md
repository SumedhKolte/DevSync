# Verification record

Date: 1 November 2026.

| Check                                                 | Result                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Strict TypeScript, including unused locals/parameters | Passed                                                                                                |
| Domain, provider, crypto and source-import tests      | 22 passed across 5 files                                                                              |
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
| Final desktop/mobile visual review                    | Not completed: browser approval gate declined local-preview access                                    |
| Saved Playwright scenarios                            | Authored, not run in this session                                                                     |
| Live GitHub/Jira imports and OAuth flows              | Not verified: provider app credentials and authorized accounts still required                         |
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

The temporary dev server and verification worker were stopped after checks. Start them using the README commands to review the app. Browser, OAuth, and provider-integration validation remain explicit follow-up requirements before production rollout.
