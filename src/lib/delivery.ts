import type { Connection, WorkspaceData, WorkItem, PullRequest } from "./types";
import { getEvidence } from "./evidence";

export function connectionHealth(connection: Connection, asOf: string) {
  if (!connection.resources.length) return "unconfigured";
  if (connection.status === "error") return "error";
  if (!connection.lastSync || connection.status === "pending") return "pending";
  const age = Date.parse(asOf) - Date.parse(connection.lastSync);
  return !Number.isFinite(age) || age >= 30 * 60_000 ? "stale" : "healthy";
}

/** Only attach edges whose endpoints are visible in the current RLS snapshot. */
export function attachPullRequests(
  items: WorkItem[],
  prs: PullRequest[],
  links: { work_item_id: string; pull_request_id: string }[],
): WorkItem[] {
  const byId = new Map(prs.map((pr) => [pr.id, pr]));
  const edges = new Map<string, Set<string>>();
  for (const link of links) {
    const ids = edges.get(link.work_item_id) ?? new Set<string>();
    ids.add(link.pull_request_id);
    edges.set(link.work_item_id, ids);
  }
  return items.map((item) => ({
    ...item,
    pullRequests: [...(edges.get(item.id) ?? [])]
      .flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  }));
}

export function deliverySummary(data: WorkspaceData) {
  const open = data.pullRequests.filter((pr) => pr.state === "open");
  const linkedIds = new Set(
    data.items.flatMap((item) => item.pullRequests.map((pr) => pr.id)),
  );
  const linked = open.filter((pr) => linkedIds.has(pr.id)).length;
  return {
    open: open.length,
    linked,
    coverage: open.length ? Math.round((linked / open.length) * 100) : null,
    review: open.filter((pr) => pr.review === "pending").length,
    ready: open.filter(
      (pr) => pr.review === "approved" && pr.checks === "passing",
    ),
    signals: getEvidence(data, Date.parse(data.asOf)),
  };
}

const plain = (value: string) =>
  value.replace(/[\r\n]+/g, " ").replace(/([\\`*_{}\[\]<>#])/g, "\\$1");
export function deliveryBrief(data: WorkspaceData): string {
  const summary = deliverySummary(data);
  return [
    `# ${plain(data.workspaceName)} — delivery brief`,
    `Snapshot: ${data.asOf}${data.mode === "demo" ? " · SAMPLE DATA" : ""}`,
    "",
    "## At a glance",
    `- ${data.items.filter((item) => item.status !== "Done").length} open work items`,
    `- ${summary.open} open pull requests; ${summary.review} awaiting review`,
    `- ${summary.linked}/${summary.open} open pull requests linked to imported Jira work`,
    `- ${summary.ready.length} open pull requests with approval and passing checks (mergeability not verified)`,
    "",
    "## Needs attention",
    ...summary.signals.map(
      (signal) =>
        `- [${signal.severity.toUpperCase()}] ${plain(signal.title)}: ${plain(signal.description)}`,
    ),
    ...(summary.signals.length
      ? []
      : ["No current signals in the imported data."]),
    "",
    "## Source freshness",
    ...data.connections.map(
      (c) =>
        `- ${c.provider === "github" ? "GitHub" : "Jira"}: ${connectionHealth(c, data.asOf)} · last successful import: ${c.lastSync || "never"}`,
    ),
    "",
    "Based on authorized, imported records only. Signals are suggestions, not verified delivery outcomes. No source records were changed.",
  ].join("\n");
}
