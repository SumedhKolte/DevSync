export type IntegrationProvider = "github" | "jira";
export const jiraScopes = [
  "read:jira-work",
  "read:jira-user",
  "manage:jira-webhook",
  "offline_access",
  "read:board-scope:jira-software",
  "read:sprint:jira-software",
];
export function githubAppSlug(value: string) {
  const slug = value.trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
export function authorizationUrl(
  provider: IntegrationProvider,
  clientId: string,
  origin: string,
  state: string,
) {
  const url = new URL(
    provider === "jira"
      ? "https://auth.atlassian.com/authorize"
      : "https://github.com/login/oauth/authorize",
  );
  url.searchParams.set("client_id", clientId.trim());
  url.searchParams.set("state", state);
  url.searchParams.set(
    "redirect_uri",
    `${origin}/api/connect/${provider}/callback`,
  );
  if (provider === "jira") {
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", jiraScopes.join(" "));
  }
  return url;
}
export interface AtlassianResource {
  id: string;
  name: string;
  url?: string;
  scopes?: string[];
}
export function jiraSites(resources: AtlassianResource[]) {
  return resources.filter(
    (site): site is AtlassianResource & { url: string } =>
      !!site.scopes?.includes("read:jira-work") &&
      !!site.url?.startsWith("https://"),
  );
}
