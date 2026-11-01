# API and permission inventory

All application APIs are same-origin routes. User-facing mutations verify the Origin header and a server-validated Supabase session. Provider webhooks authenticate using the provider mechanism instead of user sessions.

## Application routes

| Route                               | Method    | Behavior                                                                                        |
| ----------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `/auth/login`                       | POST      | Sign in with email and password; all email-sending modes are rejected.                         |
| `/auth/signup` | POST | Create a password account and session after confirming no-email signup settings. |
| `/auth/callback`                    | GET       | Exchange a PKCE authorization code for a session.                                               |
| `/auth/signout`                     | POST      | Clear the session.                                                                              |
| `/api/connect/{github\|jira}`       | GET       | Begin provider authorization with a short-lived state cookie.                                   |
| `/api/connect/{provider}/callback`  | GET       | Verify state and exchange the code; keep pending encrypted credentials in an HttpOnly cookie.   |
| `/connect/{provider}`               | GET       | Select a provider account/site from the token's actual accessible resources.                    |
| `/api/connect/{provider}/select`    | POST      | Revalidate the selected account against provider permissions and save the encrypted connection. |
| `/api/connections/{id}/resources`   | GET / PUT | List accessible resources; validate and save selected scope; queue initial import.              |
| `/api/connections/{id}`             | DELETE    | Remove the owned local connection, credentials and imported data.                               |
| `/api/sync`                         | POST      | Queue selected owned connections for refresh.                                                   |
| `/api/workspace`                    | PATCH     | Rename the owned workspace.                                                                     |
| `/api/webhooks/github`              | POST      | Verify raw-body HMAC; transactionally deduplicate and enqueue.                                  |
| `/api/webhooks/jira/{connectionId}` | POST      | Verify OAuth webhook bearer JWT; deduplicate and enqueue a canonical re-fetch.                  |

## GitHub API

Requests use GitHub App user access tokens so data access is bounded by both the user's permissions and the app installation. The API version header is pinned to `2026-03-10`. A production rollout must verify that the registered App's permissions match every requested endpoint.

| Endpoint family                                    | Purpose                                      | Read permission                      |
| -------------------------------------------------- | -------------------------------------------- | ------------------------------------ |
| `/user/installations`                              | Select an accessible installation            | App user authentication              |
| `/user/installations/{id}/repositories`            | Revalidate repository access                 | Metadata                             |
| `/repos/{owner}/{repo}`                            | Repository details                           | Metadata                             |
| `.../branches`, `.../commits`                      | Branches and recent commit metadata          | Contents                             |
| `.../pulls`, `.../pulls/{number}`                  | PR state, branch, head SHA and change counts | Pull requests                        |
| `.../pulls/{number}/reviews`, `/commits`, `/files` | Review decisions and PR evidence             | Pull requests / Contents as required |
| `.../commits/{sha}/check-runs`                     | Latest head checks                           | Checks                               |
| `.../commits/{sha}/status`                         | Combined commit statuses                     | Commit statuses                      |
| `.../actions/runs?head_sha=...`                    | Workflow runs associated with a PR head      | Actions                              |

Array endpoints follow Link pagination. Explicitly bounded recent-commit previews are labelled. PR commit/file counts are compared with detail totals to detect provider hard limits rather than silently lose data. Tokens refresh using the confidential App OAuth client credentials when needed.

## Jira Cloud API

3LO calls use `https://api.atlassian.com/ex/jira/{cloudId}`. Site selection uses the token's `/oauth/token/accessible-resources` response, not an arbitrary browser-submitted API host.

| Endpoint                            | Purpose                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `/rest/api/3/project/search`        | Accessible project discovery/revalidation.                                   |
| `/rest/api/3/field`                 | Discover custom sprint fields by schema.                                     |
| `POST /rest/api/3/search/jql`       | Import authorized selected-project work items using enhanced search cursors. |
| `/rest/api/3/issue/{id}/changelog`  | Latest 20 changelog entries per imported issue; extract status transitions.  |
| `/rest/agile/1.0/board`             | Accessible Scrum board discovery per selected project.                       |
| `/rest/agile/1.0/board/{id}/sprint` | Paginated active/future sprint metadata.                                     |
| `/rest/api/3/webhook`               | Register, renew and replace app-owned dynamic webhooks.                      |

OAuth scopes: granular only (`jiraScopes` in `src/lib/oauth.ts`): project, issue-type, user, group, avatar, field, issue-details, issue-meta, changelog, webhook, JQL, board-scope and sprint read scopes, `write:webhook:jira`, `delete:webhook:jira`, and `offline_access`. They were taken from the `x-atlassian-oauth2-scopes` entries of Atlassian's OpenAPI specs for each endpoint called. Webhooks are renewed with `PUT /rest/api/3/webhook/refresh`. Missing Jira Software/board access produces an empty sprint view; expired authorization does not get suppressed. No issue-write scope is requested.

## Official references

- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub App user access](https://docs.github.com/en/rest/apps/installations)
- [GitHub webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- [Jira Cloud REST v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Jira Software REST](https://developer.atlassian.com/cloud/jira/software/rest/)
- [Jira 3LO](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Jira webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)

## Request validation updates

JSON mutations for sign-in, workspace naming, and resource selection require `application/json` and accept at most 64 KiB. Invalid JSON returns 400, unsupported media returns 415, and oversized bodies return 413. Webhook bodies are limited to 2 MiB while streaming before parsing; malformed JSON returns 400. The existing signature/authentication checks remain in place.

Sync history is loaded server-side with the user's Supabase session and the existing owner-only `sync_runs` RLS policy. No service key or privileged browser endpoint is introduced for this view. This UI displays import attempts after the worker starts them, not queue depth or worker heartbeat health.
