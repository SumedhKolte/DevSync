import type { Activity, PullRequest, WorkItem } from "../types";
import { summarizeChecks } from "../checks";
import { extractIssueKeys } from "../correlation";
import {
  githubMetadata,
  jiraSprintMetadata,
  jiraStatusHistory,
  type SourceMetadata,
} from "./source-importers";
import {
  githubFetch,
  githubPages,
  listResources,
  providerFetch,
  type ConnectionRow,
} from "./providers";
interface GithubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged_at: string | null;
  updated_at: string;
  created_at: string;
  html_url: string;
  user: { login: string };
  head: { ref: string; sha: string };
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  requested_reviewers: { login: string }[];
}
interface GithubCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
}
const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export async function importGithub(c: ConnectionRow, token: string) {
  const available = await listResources(c, token);
  const allowed = new Map(available.map((r) => [r.id, r]));
  const rows: (PullRequest & {
    issueKeys: string[];
    linkEvidence: { field: string; keys: string[] }[];
  })[] = [];
  const events: Activity[] = [];
  const resources = await githubMetadata(c, token, available);
  // Retain open PRs and closed/merged PRs updated within 90 days.
  const cutoff = Date.now() - 90 * 86400000;
  const recent = (p: GithubPR) => Date.parse(p.updated_at) > cutoff;
  for (const selected of c.resources) {
    const resource = allowed.get(selected.id);
    if (!resource) continue; // Revoked repo vanishes in atomic snapshot.
    const repository = resource.name;
    const open = await githubPages<GithubPR>(
      `/repos/${repository}/pulls?state=open&sort=updated&direction=desc`,
      token,
    );
    // Closed PRs are newest-first, so stop paging once a page reaches the cutoff
    // instead of walking the repository's entire PR history.
    const closed = await githubPages<GithubPR>(
      `/repos/${repository}/pulls?state=closed&sort=updated&direction=desc`,
      token,
      undefined,
      (batch) => !batch.length || !recent(batch[batch.length - 1]),
    );
    const prs = [...open, ...closed.filter(recent)];
    // Fail before the per-PR detail requests rather than after them.
    if (rows.length + prs.length > 1000)
      throw new Error("Import exceeds 1,000 PRs. Select fewer repositories.");
    for (const summary of prs) {
      const { data: pr } = await githubFetch<GithubPR>(
        `/repos/${repository}/pulls/${summary.number}`,
        token,
      );
      const reviews = await githubPages<{
        user: { login: string };
        state: string;
        submitted_at: string;
      }>(`/repos/${repository}/pulls/${pr.number}/reviews`, token);
      const commits = await githubPages<GithubCommit>(
        `/repos/${repository}/pulls/${pr.number}/commits`,
        token,
      );
      const files = await githubPages<{
        filename: string;
        additions: number;
        deletions: number;
      }>(`/repos/${repository}/pulls/${pr.number}/files`, token);
      // GitHub lists at most 250 commits and 3,000 files per PR. Keep what is
      // retrievable; title, branch and description still supply issue keys.
      const workflows = await githubPages<{
        name: string;
        status: string;
        conclusion: string | null;
        html_url: string;
      }>(
        `/repos/${repository}/actions/runs?head_sha=${pr.head.sha}`,
        token,
        "workflow_runs",
      );
      const checkRuns = await githubPages<{
        status: string;
        conclusion: string | null;
        name: string;
      }>(
        `/repos/${repository}/commits/${pr.head.sha}/check-runs`,
        token,
        "check_runs",
      );
      const { data: statuses } = await githubFetch<{
        state: string;
        statuses: unknown[];
      }>(`/repos/${repository}/commits/${pr.head.sha}/status`, token);
      const checkState = summarizeChecks(checkRuns, statuses);
      const latestReviews = new Map<string, string>();
      for (const r of reviews)
        if (r.state !== "COMMENTED" && r.state !== "PENDING")
          latestReviews.set(r.user.login, r.state);
      const review = [...latestReviews.values()].includes("CHANGES_REQUESTED")
        ? "changes_requested"
        : [...latestReviews.values()].includes("APPROVED")
          ? "approved"
          : "pending";
      const evidence = [
        { field: "title", keys: extractIssueKeys(pr.title) },
        { field: "description", keys: extractIssueKeys(pr.body) },
        { field: "branch", keys: extractIssueKeys(pr.head.ref) },
        ...commits.map((commit) => ({
          field: `commit:${commit.sha}`,
          keys: extractIssueKeys(commit.commit.message),
        })),
      ].filter((e) => e.keys.length);
      rows.push({
        id: String(pr.id),
        number: pr.number,
        title: pr.title,
        body: pr.body || "",
        repository,
        branch: pr.head.ref,
        state: pr.merged_at
          ? "merged"
          : pr.state === "closed"
            ? "closed"
            : "open",
        author: pr.user.login,
        avatar: initials(pr.user.login),
        review,
        checks: checkState,
        updatedAt: pr.updated_at,
        url: pr.html_url,
        additions: pr.additions,
        deletions: pr.deletions,
        reviewers: pr.requested_reviewers.map((u) => u.login),
        commits: commits.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message.split("\n")[0],
          author: commit.commit.author.name,
          at: commit.commit.author.date,
          url: commit.html_url,
        })),
        files: files.map((f) => ({
          name: f.filename,
          additions: f.additions,
          deletions: f.deletions,
        })),
        workflows: workflows.map((w) => ({
          name: w.name,
          status: w.conclusion || w.status,
          url: w.html_url,
        })),
        issueKeys: [...new Set(evidence.flatMap((e) => e.keys))],
        linkEvidence: evidence,
      });
      if (pr.merged_at)
        events.push({
          id: `merge:${pr.id}`,
          kind: "merge",
          actor: pr.user.login,
          text: "authored a merged pull request",
          target: `${repository} #${pr.number} · ${pr.title}`,
          at: pr.merged_at,
          url: pr.html_url,
        });
      for (const commit of commits)
        events.push({
          id: `commit:${repository}:${commit.sha}`,
          kind: "commit",
          actor: commit.commit.author.name,
          text: "committed",
          target: commit.commit.message.split("\n")[0],
          at: commit.commit.author.date,
          url: commit.html_url,
        });
    }
  }
  return {
    rows,
    events: [...new Map(events.map((e) => [e.id, e])).values()],
    resources,
  };
}
interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: unknown;
    status: { name: string; statusCategory: { key: string } };
    issuetype: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string };
    project: { name: string; key: string };
    updated: string;
    [key: string]: unknown;
  };
}
export function adfText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; type?: string; content?: unknown[] };
  return (
    n.text ||
    (n.content || []).map(adfText).join(n.type === "doc" ? "\n\n" : "")
  );
}
export async function importJira(c: ConnectionRow, token: string) {
  const base = `https://api.atlassian.com/ex/jira/${c.config.cloud_id}`;
  const available = await listResources(c, token);
  const allowed = new Set(available.map((p) => p.id));
  const selected = c.resources.map((r) => r.id).filter((id) => allowed.has(id));
  if (!selected.length)
    return {
      rows: [] as WorkItem[],
      events: [] as Activity[],
      resources: [] as SourceMetadata[],
    };
  if (selected.some((id) => !/^\d+$/.test(id)))
    throw new Error("Invalid project identifier");
  const { data: fields } = await providerFetch<
    { id: string; name: string; schema?: { custom?: string } }[]
  >(`${base}/rest/api/3/field`, token);
  const sprintField = fields.find(
    (f) => f.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint",
  )?.id;
  const rows: WorkItem[] = [];
  let nextPageToken: string | undefined;
  const seenTokens = new Set<string>();
  do {
    const { data } = await providerFetch<{
      issues: JiraIssue[];
      isLast: boolean;
      nextPageToken?: string;
    }>(`${base}/rest/api/3/search/jql`, token, {
      method: "POST",
      body: JSON.stringify({
        jql: `project in (${selected.join(",")}) ORDER BY updated DESC`,
        maxResults: 100,
        fields: [
          "summary",
          "description",
          "status",
          "issuetype",
          "priority",
          "assignee",
          "project",
          "updated",
          ...(sprintField ? [sprintField] : []),
        ],
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
    });
    for (const issue of data.issues) {
      const f = issue.fields;
      const assignee = f.assignee?.displayName || "Unassigned";
      const sprints =
        sprintField && Array.isArray(f[sprintField])
          ? (f[sprintField] as { name: string; state: string }[])
          : [];
      const sprint =
        sprints.find((s) => s.state === "active") || sprints.at(-1);
      const category = f.status.statusCategory.key;
      rows.push({
        id: issue.id,
        key: issue.key,
        title: f.summary,
        status:
          category === "done"
            ? "Done"
            : category === "new"
              ? "To do"
              : /review/i.test(f.status.name)
                ? "In review"
                : "In progress",
        sourceStatus: f.status.name,
        type: /bug/i.test(f.issuetype.name)
          ? "Bug"
          : /story/i.test(f.issuetype.name)
            ? "Story"
            : "Task",
        priority: /high|highest|critical|blocker/i.test(f.priority?.name || "")
          ? "High"
          : /low|lowest/i.test(f.priority?.name || "")
            ? "Low"
            : "Medium",
        assignee,
        avatar: initials(assignee),
        project: f.project.name,
        description: adfText(f.description),
        pullRequests: [],
        updatedAt: f.updated,
        url: `${c.config.site_url}/browse/${issue.key}`,
        sprint: sprint?.name || null,
      });
    }
    nextPageToken = data.isLast ? undefined : data.nextPageToken;
    if (nextPageToken && seenTokens.has(nextPageToken))
      throw new Error("Jira returned a repeated page cursor");
    if (nextPageToken) seenTokens.add(nextPageToken);
    if (rows.length > 1000)
      throw new Error(
        "Import exceeds 1,000 work items. Select fewer Jira projects.",
      );
  } while (nextPageToken);
  return {
    rows,
    events: await jiraStatusHistory(c, token, rows),
    resources: await jiraSprintMetadata(c, token),
  };
}
