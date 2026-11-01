export type IntegrationProvider = "github" | "jira";
// Granular scopes, taken from Atlassian's OpenAPI spec for each Jira endpoint
// DevSync calls. Classic scopes (read:jira-work …) are not mixed in: Atlassian
// denied consent for this app when classic and granular scopes were combined.
export const jiraScopes = [
  // Project search (scope selection and access checks)
  "read:project:jira",
  "read:project.property:jira",
  "read:project-category:jira",
  "read:project-version:jira",
  "read:project.component:jira",
  "read:issue-type:jira",
  "read:issue-type-hierarchy:jira",
  "read:application-role:jira",
  "read:user:jira",
  "read:group:jira",
  "read:avatar:jira",
  // Fields, issue search and status history
  "read:field:jira",
  "read:field-configuration:jira",
  "read:field.default-value:jira",
  "read:field.option:jira",
  "read:issue-details:jira",
  "read:issue-meta:jira",
  "read:issue.changelog:jira",
  // Dynamic webhooks
  "read:webhook:jira",
  "write:webhook:jira",
  "delete:webhook:jira",
  "read:jql:jira",
  // Boards and sprints
  "read:board-scope:jira-software",
  "read:sprint:jira-software",
  "offline_access",
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
      // Granted scopes name the site's issue access: granular or classic.
      !!site.scopes?.some(
        (scope) =>
          scope === "read:issue-details:jira" || scope === "read:jira-work",
      ) && !!site.url?.startsWith("https://"),
  );
}
