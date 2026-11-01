import { retryDelay } from "./retry";
import { providerSignal } from "./provider-budget";
export class ProviderError extends Error {
  constructor(
    public status: number,
    public retryAfter = 60,
  ) {
    super(
      status === 401
        ? "Authorization expired. Reconnect your account."
        : status === 403
          ? "Provider access was denied. Check account permissions."
          : status === 429
            ? "Provider rate limit reached. Sync will retry."
            : "Provider request failed. Sync will retry if appropriate.",
    );
  }
}
export async function providerFetch<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    signal: providerSignal(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ProviderError(response.status, retryDelay(response.headers));
  }
  return {
    data: (response.status === 204 ? undefined : await response.json()) as T,
    headers: response.headers,
  };
}
export const githubFetch = <T>(path: string, token: string) =>
  providerFetch<T>(`https://api.github.com${path}`, token, {
    headers: {
      "X-GitHub-Api-Version": "2026-03-10",
      Accept: "application/vnd.github+json",
    },
  });
/** `stop` ends paging early once a batch shows later pages are not needed. */
export async function githubPages<T>(
  path: string,
  token: string,
  property?: string,
  stop?: (batch: T[]) => boolean,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const { data, headers } = await githubFetch<T[] | Record<string, T[]>>(
      `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      token,
    );
    const batch = property
      ? (data as Record<string, T[]>)[property]
      : (data as T[]);
    if (!Array.isArray(batch)) throw new Error("Unexpected provider response");
    all.push(...batch);
    if (!headers.get("link")?.includes('rel="next"') || stop?.(batch)) break;
    if (++page > 100)
      throw new Error(
        "Import exceeded the safety limit. Narrow your repository scope.",
      );
  }
  return all;
}
export interface ProviderTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}
export type Resource = { id: string; name: string };
export interface ConnectionRow {
  id: string;
  workspace_id: string;
  owner_id: string;
  provider: "github" | "jira";
  provider_account_id: string;
  scope_version: number;
  config: {
    cloud_id?: string;
    site_url?: string;
    installation_id?: number;
    webhook_ids?: number[];
    webhook_expires_at?: number;
    webhook_scope?: string;
  };
  resources: Resource[];
}
export async function refreshTokens(
  provider: "github" | "jira",
  tokens: ProviderTokens,
): Promise<ProviderTokens> {
  if (!tokens.expires_at || tokens.expires_at > Date.now() + 120000)
    return tokens;
  if (!tokens.refresh_token) throw new ProviderError(401);
  const response = await fetch(
    provider === "jira"
      ? "https://auth.atlassian.com/oauth/token"
      : "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: providerSignal(),
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id:
          process.env[
            provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"
          ],
        client_secret:
          process.env[
            provider === "jira" ? "JIRA_CLIENT_SECRET" : "GITHUB_CLIENT_SECRET"
          ],
        refresh_token: tokens.refresh_token,
      }),
    },
  );
  if (!response.ok)
    throw new ProviderError(response.status, retryDelay(response.headers));
  const value = await response.json();
  if (!value.access_token) throw new ProviderError(401);
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token || tokens.refresh_token,
    expires_at: value.expires_in
      ? Date.now() + value.expires_in * 1000
      : undefined,
  };
}
export async function listResources(
  connection: ConnectionRow,
  token: string,
): Promise<Resource[]> {
  if (connection.provider === "github") {
    const repos = await githubPages<{ id: number; full_name: string }>(
      `/user/installations/${connection.config.installation_id}/repositories`,
      token,
      "repositories",
    );
    return repos.map((r) => ({ id: String(r.id), name: r.full_name }));
  }
  const result: Resource[] = [];
  let startAt = 0;
  for (;;) {
    const { data } = await providerFetch<{
      values: { id: string; name: string; key: string }[];
      isLast: boolean;
    }>(
      `https://api.atlassian.com/ex/jira/${connection.config.cloud_id}/rest/api/3/project/search?maxResults=100&startAt=${startAt}`,
      token,
    );
    result.push(
      ...data.values.map((p) => ({ id: p.id, name: `${p.name} (${p.key})` })),
    );
    if (data.isLast || !data.values.length) break;
    startAt += data.values.length;
    if (startAt > 10000)
      throw new Error("Project listing exceeded the safety limit");
  }
  return result;
}

export type GithubCredentialStatus =
  "valid" | "unknown-client" | "wrong-secret" | "unverified";
/**
 * Exchange a deliberately invalid code. GitHub answers 404 for an unknown
 * client ID, incorrect_client_credentials for a wrong secret, and
 * bad_verification_code when both are right. No token is ever issued.
 */
export async function githubCredentialStatus(): Promise<GithubCredentialStatus> {
  try {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID?.trim(),
          client_secret: process.env.GITHUB_CLIENT_SECRET?.trim(),
          code: "devsync-credential-check",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 404) return "unknown-client";
    const body = await response.json().catch(() => ({}));
    if (body.error === "incorrect_client_credentials") return "wrong-secret";
    if (body.error === "bad_verification_code") return "valid";
  } catch {
    /* Network failures leave the check unverified rather than blocking. */
  }
  return "unverified";
}
