# DevSync: discovery and proposed implementation

Research date: 1 November 2026. Status: original stack proposal. Implementation is underway; see README.md and docs/VERIFICATION.md for current behavior and verification.

## Product and scope

Source brief: `/Users/sumedhkolte/Downloads/GitHub_Jira_Integration_Problem_Statement.pdf` (8 pages, reviewed in full).

Build a delivery dashboard that connects GitHub development activity to Jira work items. The brief's suggested technologies are guidance; Supabase is the user's database requirement.

Initial assumptions: GitHub.com, Jira Cloud with Jira Software when sprint data is available, and a read-only first release. Enterprise Server and Jira Data Center require separate connector work. The schema will include workspace boundaries, but the initial UI will focus on one selected GitHub installation and Jira site per workspace. Source access remains user-specific.

Required experience:

- Secure sign-in, GitHub App installation, Jira OAuth authorization, scope selection and connection health.
- Repository and branch views; PR details, reviews, commits, changed-file metadata, check results and Actions runs.
- Jira project, work item and available board/sprint views, including status, assignee, priority and configurable fields.
- Explainable Jira-key correlation, visible unlinked records, and review of ambiguous matches.
- Search and filters, linked-record details, chronological activity and manual refresh.
- Initial import, incremental updates, authenticated webhooks, reconciliation, pagination, retries and diagnostics.
- Access isolation, audit history, setup documentation and meaningful automated tests.

Jira comments/transitions, GitHub merge actions, security scanning and deployment reporting are later phases. PR, review, check, Jira and deployment states remain separate. A merge never automatically implies QA acceptance or release.

## Recommended stack

| Layer                     | Choice                                                                    | Purpose                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Web application           | Next.js App Router, React, TypeScript                                     | Dashboard, authenticated pages, OAuth callbacks, API routes and webhook ingress in one application.                    |
| UI                        | Tailwind CSS, shadcn/ui, Lucide                                           | Consistent, customizable interface with keyboard navigation and accessible primitives.                                 |
| Data-heavy UI             | TanStack Table; TanStack Query where client caching is useful             | Server-paginated tables, filters, refresh and background-job progress.                                                 |
| Validation                | Zod                                                                       | Validate settings, API requests and the provider fields our application consumes.                                      |
| Persistence               | Supabase Postgres                                                         | Normalized records, relationships, sync cursors, audit events and indexed search.                                      |
| Sign-in and authorization | Supabase Auth, `@supabase/ssr`, Postgres RLS                              | App sessions and policies for user/workspace/source visibility. Provider connections use separate authorization flows. |
| Database workflow         | Supabase CLI SQL migrations and generated TypeScript types                | One authoritative schema, including policies, functions and queue setup. No ORM needed initially.                      |
| Jobs                      | Supabase Queues (`pgmq`) with a separate Node.js/TypeScript consumer      | Durable imports, event processing and bounded retries without an initial Redis dependency.                             |
| Scheduling                | Supabase Cron                                                             | Enqueue reconciliation, access revalidation and Jira webhook-renewal work. External API work runs in the consumer.     |
| Connectors                | Octokit for GitHub; typed `fetch` adapter for Jira REST v3 and Agile APIs | Explicit pagination, provider error handling and rate-limit control.                                                   |
| Search                    | PostgreSQL full-text search and `pg_trgm`                                 | Search authorized titles, keys and repository metadata without a separate search service.                              |
| Live updates              | Scoped Supabase Realtime notifications                                    | Notify clients of completed imports and changed rows; refetch authorized data.                                         |
| Verification              | Vitest, MSW, pgTAP, Playwright                                            | Domain/connector tests, realistic failure responses, database policy tests and user journeys.                          |
| Operations                | Structured redacted logs; Sentry when configured                          | Diagnose provider failures, jobs and UI errors using correlation IDs.                                                  |
| Repository                | pnpm workspace                                                            | Share types, connector code and domain rules between app and worker.                                                   |

Recommended production topology: web app on Vercel, an always-running Node worker on a container host such as Railway, and Supabase for persistence/auth/queues. This is a proposed deployment topology; no service has been provisioned or published. Pin supported stable package versions and commit the lockfile when implementation starts. Verify host plans and regional availability at deployment time.

Next.js supports server components and route handlers, making a separate general-purpose API service unnecessary for the first release. Long imports remain independently deployable in the worker. See [Next.js App Router](https://nextjs.org/docs/app), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), and [Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

Supabase provides [durable Postgres queues](https://supabase.com/docs/guides/queues), [Cron](https://supabase.com/docs/guides/cron) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security). The consumer still needs application-level idempotency: queue visibility guarantees do not guarantee exactly-once side effects.

## Distinctive feature: Delivery Evidence

A configurable view of delivery inconsistencies with an evidence trail. Proposed examples:

- A Jira work item in a configured completed status has a relevant linked PR whose latest required check failed.
- A fix is merged but the work item remains in a configured QA state beyond the team's chosen threshold.
- A PR has waited for review longer than the configured threshold.
- A PR has no validated Jira reference, or contains conflicting references requiring review.

Each signal shows its rule, observed timestamps, last successful sync, source links and the evidence that triggered it. Missing checks are labelled unknown. Missing permission or stale data lowers confidence and can suppress a signal; it never becomes an invented success or failure. Rules consider current commit SHAs and team configuration. A work item can legitimately span several PRs, and a PR may legitimately implement several work items.

The detail view offers a connected sequence: work item -> branch/commit -> PR -> review -> checks -> merge, with evidence provenance on every link. This is a product differentiation proposal, not a claim of market exclusivity. Jira already exposes linked development information; DevSync should add actionable cross-record analysis rather than merely reproduce that panel. See [Atlassian's existing development view](https://support.atlassian.com/jira-software-cloud/docs/view-development-information-for-an-issue/).

## Integration decisions verified against official documentation

### GitHub

Use a GitHub App with repository selection and minimum read permissions. Candidate repository permissions are Metadata, Contents, Pull requests, Checks, Actions and Commit statuses; verify the exact requirements for each implemented endpoint. Authenticate reads as an installation and check the viewing user's source access separately. App sign-in and repository installation are distinct flows. Prefer installation repository discovery over assuming `/user/repos` reflects an installation's scope. [GitHub recommends Apps for fine-grained integration permissions](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app).

Verify webhook signatures over raw bytes, durably record/enqueue accepted events before acknowledging them, and deduplicate by provider delivery identifier scoped to connection/installation. Missed deliveries require recovery; do not assume GitHub retries every failed delivery. Follow [GitHub webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks).

### Jira

Use OAuth 2.0 authorization code grants (3LO), server-side callback validation and `offline_access` for background synchronization. Persist rotated refresh tokens atomically with a connection-level lock. Send authorized requests through `https://api.atlassian.com/ex/jira/{cloudId}/...`. Discover accessible sites rather than trusting a browser-submitted tenant URL. See [Jira 3LO documentation](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/).

Use enhanced JQL search at `/rest/api/3/search/jql`; follow its cursor contract rather than applying one generic pagination scheme to every resource. Discover custom field IDs instead of hardcoding a sprint field. Boards and sprints depend on Jira Software access. See [issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/) and [Jira Software APIs](https://developer.atlassian.com/cloud/jira/software/rest/).

Dynamic webhooks expire after 30 days; renew before expiry. OAuth webhooks use bearer-token verification with the app client secret, distinct from signed admin webhooks. OAuth webhook registration has per-user/tenant limits, so group supported filters and reconcile periodically. See [Jira webhook guidance](https://developer.atlassian.com/cloud/jira/platform/webhooks/).

Non-public OAuth apps deliver dynamic webhooks only when the app owner matches the registering user. Test the actual app distribution configuration; surface any limitation and use scheduled reconciliation as a fallback. Registration requires webhook-management scope even though business data is read-only. See [dynamic webhook registration](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-webhooks/).

## Data and authorization design

Candidate entities: profiles, workspaces, memberships, provider connections, repositories, projects, boards, sprints, work items, branches, commits, pull requests, reviews, checks, workflow runs, development links, source-access grants, activity events, sync runs/cursors, webhook deliveries, audit events and evidence signals. Many-to-many relationships cover commits/PRs and work items/PRs. Uniqueness uses stable provider IDs plus tenant/installation scope; Jira issue keys are mutable display identifiers.

Store normalized metadata and selected fields, not entire repositories. Retain raw event payloads only for a bounded diagnostic period and redact secrets. Keep token ciphertext and application credentials outside client-readable schemas; encrypt provider tokens using a versioned server-held key. Reconnection and deletion must invalidate jobs and remove applicable data.

Workspace membership alone must not expose an administrator's private source data. Initially, connection-derived data is visible to its authorized owner. Shared views require independently established viewer access to the relevant repository/project and issue, including Jira issue security. Policies and server checks must cover search, counts, timelines, cached results and Realtime. Revalidate grants with a bounded freshness policy, purge denied records and fail closed on expired access. Document the revocation-delay bound; cached permissions cannot guarantee instantaneous revocation.

Use user-scoped Supabase clients for app reads. Elevated worker/database credentials bypass RLS, so every privileged operation needs explicit tenant/connection scoping. Cross-tenant relationships must be prevented by database constraints as well as API validation. JWT presence or workspace selection in the browser is insufficient authorization.

## Synchronization and correlation

Flow: provider webhook or manual refresh -> validated ingress -> transactionally stored delivery and queued job -> worker -> connector -> normalized upserts -> correlation -> evidence rules -> authorized UI refresh.

Persist progress only after a page/batch commits. Use bounded retries with jitter, respect provider rate-limit headers, lock concurrent refreshes and archive exhausted jobs with replay diagnostics. Make replay safe and protect current state from delayed/out-of-order events by refetching canonical records and comparing provider versions/timestamps. Reconciliation covers deletions and revoked access, not only records returned by incremental searches.

Extract Jira-key candidates from PR titles/descriptions, branches and commit messages. Validate against selected projects/sites and retain the exact source field/reference that supports each link. Distinguish confirmed multi-work-item relationships from unresolved conflicting evidence. The same textual key can exist on different Jira sites. Do not use title similarity as an authoritative link.

## Implementation order and completion gates

1. Foundation: workspace, app shell, environment template, migrations, Supabase Auth and policy tests. Include clearly labelled isolated demo data for local review.
2. Real connections: GitHub App and Jira OAuth callbacks, scope selection, encrypted credentials and actionable health checks.
3. Imports: paginated repositories/PRs/reviews/commits/checks, projects/work items/available sprints; resumable jobs and rate-limit diagnostics.
4. Unified experience: search/filter tables, detail views, evidence-backed correlation, activity history, loading/empty/error states and responsive keyboard-friendly navigation.
5. Reliability: authenticated webhook ingestion, deduplication, retries, reconciliation, token rotation, webhook renewal and access revocation.
6. Delivery Evidence: configurable rules, source traceability, fresh/stale/unknown states and user-reviewed link resolution.
7. Handover: type checking, production build, meaningful automated tests, manual browser QA, endpoint/permission inventory, setup guide and documented limitations.

Acceptance tests must exercise duplicate and delayed events, multi-page imports, rate limits, expired tokens, ambiguous links, unavailable sprint fields, cross-user/tenant access denial and revoked source access. End-to-end coverage must distinguish a fixture-backed demo from live-provider validation. Do not claim a working live integration until it has been exercised against authorized accounts.

## Required external configuration for live verification

- Supabase project URL and publishable key; server-side privileged key and local database tooling as required.
- GitHub App registration, app ID/private key, webhook secret and installation access to chosen repositories; user authorization credentials if used for viewer access checks.
- Atlassian developer app, client ID/secret, callback URL, required scopes and an authorized Jira Cloud test site.
- Server-held token encryption key, stable HTTPS callback/webhook origin and a deployed worker environment.

Implementation can proceed with environment placeholders and isolated demo fixtures. Credentials belong in local ignored environment files or deployment secret storage, never this plan or committed source. No paid services or deployment have been authorized by this discovery document itself.
