import { extractIssueKeys } from "./correlation";
import type { EvidenceSignal, WorkspaceData } from "./types";
export function getEvidence(
  data: WorkspaceData,
  now = Date.now(),
): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];
  const linked = new Set(
    data.items.flatMap((item) => item.pullRequests.map((pr) => pr.id)),
  );
  const staleAfter = 7 * 86400000;
  for (const item of data.items) {
    // Stale imported data must not create definitive delivery assertions.
    if (now - Date.parse(item.updatedAt) > staleAfter) continue;
    for (const pr of item.pullRequests) {
      if (now - Date.parse(pr.updatedAt) > staleAfter) continue;
      if (pr.state === "merged" && item.status === "In progress")
        signals.push({
          id: `drift-${item.id}-${pr.id}`,
          rule: "status-drift",
          title: "Merged, still in progress",
          description: `${item.key} · Code is merged. Check whether the Jira status needs updating.`,
          severity: "medium",
          item,
          pr,
          observedAt: pr.updatedAt,
          sourceUrl: item.url,
        });
    }
  }
  for (const pr of data.pullRequests) {
    const age = now - Date.parse(pr.updatedAt);
    if (!Number.isFinite(age) || age > staleAfter || pr.state !== "open")
      continue;
    if (pr.checks === "failing") {
      const item = data.items.find((i) =>
        i.pullRequests.some((p) => p.id === pr.id),
      );
      signals.push({
        id: `failed-${pr.id}`,
        rule: "failed-checks",
        title: "Checks need attention",
        description: `${item?.key || pr.repository} · PR #${pr.number} has failing checks on its latest commit.`,
        severity: "high",
        item,
        pr,
        observedAt: pr.updatedAt,
        sourceUrl: pr.url,
      });
    }
    if (!linked.has(pr.id)) {
      const hasCandidates = extractIssueKeys(pr.title, pr.branch).length > 0;
      signals.push({
        id: `unlinked-${pr.id}`,
        rule: hasCandidates ? "ambiguous" : "unlinked",
        title: hasCandidates
          ? "Jira reference needs review"
          : "Missing a Jira link",
        description: `${pr.repository} · PR #${pr.number} ${hasCandidates ? "references a work item outside the imported scope." : "has no verified work item."}`,
        severity: "low",
        pr,
        observedAt: pr.updatedAt,
        sourceUrl: pr.url,
      });
    } else if (pr.review === "pending" && age > 48 * 3600000)
      signals.push({
        id: `review-${pr.id}`,
        rule: "review-wait",
        title: "Quiet PR, review still pending",
        description: `${pr.repository} · PR #${pr.number} has had no update for over 48 hours and awaits review.`,
        severity: "medium",
        pr,
        observedAt: pr.updatedAt,
        sourceUrl: pr.url,
      });
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return signals
    .filter((signal, i, all) => all.findIndex((s) => s.id === signal.id) === i)
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}
