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
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const delay = retryAfter
      ? Number(retryAfter) ||
        Math.max(1, (Date.parse(retryAfter) - Date.now()) / 1000)
      : reset
        ? Math.max(1, reset - Date.now() / 1000)
        : 60;
    throw new ProviderError(response.status, Math.min(86400, Math.ceil(delay)));
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
export async function githubPages<T>(
  path: string,
  token: string,
  property?: string,
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
    if (!headers.get("link")?.includes('rel="next"')) break;
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
      signal: AbortSignal.timeout(20000),
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
  if (!response.ok) throw new ProviderError(response.status);
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
