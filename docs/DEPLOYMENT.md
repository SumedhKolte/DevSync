# Production deployment

Production runs three pieces. All of them deploy from `main`.

| Piece                                               | Host                                                   | Address                             |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------- |
| Next.js app (pages, API, OAuth callbacks, webhooks) | Vercel project `devsync`, functions in Mumbai (`bom1`) | https://devsync-beige.vercel.app    |
| Queue worker (`npm run worker`)                     | Render free web service `devsync-worker`, Singapore    | https://devsync-worker.onrender.com |
| Database, auth, queue and scheduler                 | Supabase project `anjfnzzdkjuwzpebxwus`, Mumbai        | —                                   |

Local development (`npm run dev`) uses the same Supabase project, so accounts, connections and imported data are shared with production.

## Environment variables

Vercel (Production and Preview) and Render need the same 11 variables:

`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`.

`NEXT_PUBLIC_APP_URL` is `https://devsync-beige.vercel.app` in both. The worker uses it to register Jira webhooks. `TOKEN_ENCRYPTION_KEY` must match local development, or stored provider credentials cannot be decrypted.

The gitignored `.env.production.deploy` holds these values for import. Use **Import .env** on Vercel and **Add from .env** on Render. Never commit it. If the worker is misconfigured, it logs `worker.misconfigured` with the missing names and exits.

## Keeping the free worker awake

Render's free plan sleeps a service after 15 minutes without HTTP traffic. Imported data becomes unreadable 30 minutes after its last successful sync, so the worker must keep running. Migration `202611010004_worker_keepalive.sql` schedules `devsync-worker-keepalive` every 10 minutes. The job requests the URL stored in `private.worker_settings`:

```sql
insert into private.worker_settings(keepalive_url)
values ('https://devsync-worker.onrender.com/healthz')
on conflict (id) do update set keepalive_url = excluded.keepalive_url;
```

`/healthz` returns `{"ok":true,"lastPollAt":…}`. A recent `lastPollAt` means the worker is reading the queue. Free services in a Render workspace share 750 instance hours a month, and an always-awake worker uses about 744. Move the worker to a paid plan if other free services need hours.

The worker also pokes itself. While it runs on Render it requests its own public `/healthz` address (from `RENDER_EXTERNAL_URL`, which Render sets) every 9 minutes, which counts as inbound traffic and resets the 15-minute idle timer. This is the first line of defence. The Supabase job above is the backup: it wakes the instance if it ever restarts or sleeps, and it works even if the self-ping stops. Set `KEEPALIVE_ORIGIN` to override the address on another host. Failed self-pings log `worker.selfping_failed`; the start-up line is `worker.selfping_started`. Neither poke runs on a local machine, because the self-ping needs an HTTPS address.

## Provider settings

GitHub App (`devsync-sumedh-local`):

- Redirect URIs: `https://devsync-beige.vercel.app/api/connect/github/callback`, and `http://127.0.0.1:3000/api/connect/github/callback` for local development.
- Webhook: active, URL `https://devsync-beige.vercel.app/api/webhooks/github`, secret `GITHUB_WEBHOOK_SECRET`.

Atlassian OAuth app (`DevSync-local`):

- Callback URLs: `https://devsync-beige.vercel.app/api/connect/jira/callback` and `http://127.0.0.1:3000/api/connect/jira/callback`.
- Granular scopes: the list on `/connect/jira/setup`.

The worker registers Jira webhooks against the production URL and renews them before their 30-day expiry.

## Deployment protection

Vercel Authentication applies to preview deployments only. Production must stay public, because OAuth callbacks and provider webhooks cannot pass Vercel's login.

## Checks after a deploy

- `https://devsync-beige.vercel.app/login` returns 200, and `/connections` returns 307 to `/login` when signed out.
- `https://devsync-worker.onrender.com/healthz` returns 200 with a recent `lastPollAt`.
- After **Refresh** in the app, Connections shows a new completed sync.
