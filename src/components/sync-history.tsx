"use client";
import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/types";

export function SyncHistory({ data }: { data: WorkspaceData }) {
  const [filter, setFilter] = useState("all");
  const runs = data.syncRuns.filter(
    (run) => filter === "all" || run.connectionId === filter,
  );
  return (
    <section className="panel sync-history">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SOURCE OBSERVABILITY</span>
          <h2>
            Sync history{" "}
            {data.mode === "demo" && (
              <span className="history-demo">Sample</span>
            )}
          </h2>
          <p>The latest 30 import attempts. All times in UTC.</p>
        </div>
        <select
          className="filter-select"
          aria-label="Filter sync history by source"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All sources</option>
          {data.connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.provider === "github" ? "GitHub" : "Jira"}
            </option>
          ))}
        </select>
      </div>
      {runs.length ? (
        <div className="sync-table-wrap">
          <table className="sync-table">
            <thead>
              <tr>
                <th>Source / started</th>
                <th>Result</th>
                <th>Records</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const connection = data.connections.find(
                  (c) => c.id === run.connectionId,
                );
                const seconds = run.finishedAt
                  ? Math.max(
                      0,
                      Math.round(
                        (Date.parse(run.finishedAt) -
                          Date.parse(run.startedAt)) /
                          1000,
                      ),
                    )
                  : null;
                const expired =
                  run.status === "running" &&
                  Date.parse(data.asOf) - Date.parse(run.startedAt) >
                    15 * 60_000;
                const Icon =
                  run.status === "complete"
                    ? CheckCircle2
                    : run.status === "failed"
                      ? TriangleAlert
                      : run.status === "running"
                        ? RefreshCw
                        : Clock3;
                return (
                  <tr key={run.id}>
                    <td>
                      <strong>
                        {connection?.provider === "github"
                          ? "GitHub"
                          : connection?.provider === "jira"
                            ? "Jira Cloud"
                            : "Removed source"}
                      </strong>
                      <time dateTime={run.startedAt}>
                        {new Date(run.startedAt).toLocaleString("en-GB", {
                          timeZone: "UTC",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </time>
                    </td>
                    <td>
                      <span className={`run-status ${run.status}`}>
                        <Icon size={14} />
                        {expired
                          ? "Interrupted"
                          : run.status === "complete"
                            ? "Completed"
                            : run.status === "retrying"
                              ? "Retry scheduled"
                              : run.status.charAt(0).toUpperCase() +
                                run.status.slice(1)}
                      </span>
                      {(run.error || expired) && (
                        <p className="run-error">
                          {expired
                            ? "No completion reported within the import lease. A later attempt may recover this source."
                            : run.error}
                        </p>
                      )}
                    </td>
                    <td>
                      {run.status === "complete"
                        ? run.recordsCount.toLocaleString("en-US")
                        : "—"}
                    </td>
                    <td>
                      {seconds === null
                        ? "—"
                        : seconds < 60
                          ? `${seconds}s`
                          : `${Math.floor(seconds / 60)}m ${seconds % 60}s`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Activity size={25} />
          <h3>No imports yet</h3>
          <p>
            Select your repositories and projects, then refresh. Import attempts
            will appear here when the worker starts.
          </p>
        </div>
      )}
    </section>
  );
}
