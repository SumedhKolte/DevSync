import type { Repository, Sprint } from "../types";
import {
  githubFetch,
  githubPages,
  listResources,
  providerFetch,
  type ConnectionRow,
  type Resource,
  ProviderError,
} from "./providers";
export type SourceMetadata =
  | { kind: "repository"; payload: Repository }
  | { kind: "sprint"; payload: Sprint };
export async function githubMetadata(
  c: ConnectionRow,
  token: string,
  available?: Resource[],
): Promise<SourceMetadata[]> {
  const allowed = available ?? (await listResources(c, token));
  const result: SourceMetadata[] = [];
  for (const selected of c.resources) {
    const resource = allowed.find((r) => r.id === selected.id);
    if (!resource) continue;
    const { data: repo } = await githubFetch<{
      id: number;
      full_name: string;
      description: string | null;
      default_branch: string;
      private: boolean;
      html_url: string;
    }>(`/repos/${resource.name}`, token);
    const branches = await githubPages<{
      name: string;
      protected: boolean;
      commit: { sha: string };
    }>(`/repos/${resource.name}/branches`, token);
    const { data: commits } = await githubFetch<
      {
        sha: string;
        html_url: string;
        commit: { message: string; author: { name: string; date: string } };
      }[]
    >(`/repos/${resource.name}/commits?per_page=30`, token).catch((error) => {
      if (error instanceof ProviderError && error.status === 409)
        return { data: [], headers: new Headers() };
      throw error;
    });
    result.push({
      kind: "repository",
      payload: {
        id: String(repo.id),
        name: repo.full_name,
        description: repo.description || "",
        defaultBranch: repo.default_branch,
        private: repo.private,
        url: repo.html_url,
        branches: branches.map((b) => ({
          name: b.name,
          sha: b.commit.sha,
          protected: b.protected,
        })),
        commits: commits.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message.split("\n")[0],
          author: commit.commit.author.name,
          at: commit.commit.author.date,
          url: commit.html_url,
        })),
      },
    });
  }
  return result;
}
export async function jiraSprintMetadata(
  c: ConnectionRow,
  token: string,
  available?: Resource[],
): Promise<SourceMetadata[]> {
  try {
    return await accessibleJiraSprints(c, token, available);
  } catch (error) {
    if (error instanceof ProviderError && [403, 404].includes(error.status))
      return [];
    throw error;
  }
}
async function accessibleJiraSprints(
  c: ConnectionRow,
  token: string,
  available?: Resource[],
): Promise<SourceMetadata[]> {
  const base = `https://api.atlassian.com/ex/jira/${c.config.cloud_id}/rest/agile/1.0`;
  const result = new Map<string, SourceMetadata>();
  const seenBoards = new Set<number>();
  const allowed = available ?? (await listResources(c, token));
  const visible = new Set(allowed.map((r) => r.id));
  for (const project of c.resources.filter((r) => visible.has(r.id))) {
    let start = 0;
    for (;;) {
      const { data } = await providerFetch<{
        values: { id: number; name: string; type: string }[];
        isLast: boolean;
      }>(
        `${base}/board?projectKeyOrId=${encodeURIComponent(project.id)}&maxResults=50&startAt=${start}`,
        token,
      );
      for (const board of data.values) {
        if (board.type !== "scrum" || seenBoards.has(board.id)) continue;
        seenBoards.add(board.id);
        let sprintStart = 0;
        for (;;) {
          const { data: sprints } = await providerFetch<{
            values: {
              id: number;
              name: string;
              state: string;
              goal?: string;
              startDate?: string;
              endDate?: string;
            }[];
            isLast: boolean;
          }>(
            `${base}/board/${board.id}/sprint?state=active,future&maxResults=50&startAt=${sprintStart}`,
            token,
          );
          for (const sprint of sprints.values)
            result.set(String(sprint.id), {
              kind: "sprint",
              payload: {
                id: String(sprint.id),
                name: sprint.name,
                state: sprint.state,
                board: board.name,
                goal: sprint.goal || "",
                startDate: sprint.startDate,
                endDate: sprint.endDate,
              },
            });
          if (sprints.isLast || !sprints.values.length) break;
          sprintStart += sprints.values.length;
          if (sprintStart > 1000)
            throw new Error("Sprint import exceeds the 1,000 record limit.");
        }
      }
      if (data.isLast || !data.values.length) break;
      start += data.values.length;
      if (start > 1000)
        throw new Error("Board import exceeds the 1,000 record limit.");
    }
  }
  return [...result.values()];
}
export async function jiraStatusHistory(
  c: ConnectionRow,
  token: string,
  items: { id: string; key: string; title: string; url: string }[],
) {
  const events: import("../types").Activity[] = [];
  type History = {
    id: string;
    created: string;
    author?: { displayName: string };
    items: { field: string; fromString?: string; toString?: string }[];
  };
  const base = `https://api.atlassian.com/ex/jira/${c.config.cloud_id}/rest/api/3`;
  for (const item of items) {
    const url = `${base}/issue/${encodeURIComponent(item.id)}/changelog`;
    const { data: first } = await providerFetch<{
      values: History[];
      total: number;
    }>(`${url}?maxResults=20&startAt=0`, token);
    const histories =
      first.total > 20
        ? (
            await providerFetch<{ values: History[] }>(
              `${url}?maxResults=20&startAt=${first.total - 20}`,
              token,
            )
          ).data.values
        : first.values;
    for (const history of histories)
      for (const change of history.items.filter((i) => i.field === "status"))
        events.push({
          id: `jira:${item.id}:${history.id}`,
          kind: "issue",
          actor: history.author?.displayName || "Jira",
          text: `changed status from ${change.fromString || "unknown"} to ${change.toString || "unknown"}`,
          target: `${item.key} · ${item.title}`,
          at: history.created,
          url: item.url,
        });
  }
  return events;
}
