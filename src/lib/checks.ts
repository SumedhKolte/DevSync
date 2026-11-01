import type { CheckState } from "./types";
export function summarizeChecks(
  checks: { status: string; conclusion: string | null }[],
  status: { state: string; statuses: unknown[] },
): CheckState {
  if (
    checks.some((r) =>
      [
        "failure",
        "timed_out",
        "cancelled",
        "action_required",
        "startup_failure",
      ].includes(r.conclusion || ""),
    ) ||
    (status.statuses.length > 0 && ["failure", "error"].includes(status.state))
  )
    return "failing";
  if (
    checks.some((r) => r.status !== "completed") ||
    (status.statuses.length > 0 && status.state === "pending")
  )
    return "pending";
  if (
    checks.some((r) => r.conclusion === "success") ||
    (status.statuses.length > 0 && status.state === "success")
  )
    return "passing";
  return "unknown";
}
