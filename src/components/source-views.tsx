"use client";
import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  LockKeyhole,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { Repository, WorkItem, WorkspaceData } from "@/lib/types";
import { extractIssueKeys } from "@/lib/correlation";
import { Modal } from "./ui";
export function RepositoryView({
  data,
  onSelectItem,
}: {
  data: WorkspaceData;
  onSelectItem: (item: WorkItem) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    data.repositories.find((repo) => repo.id === selectedId) ?? null;
  const setSelected = (repo: Repository | null) =>
    setSelectedId(repo?.id ?? null);
  return (
    <>
      <div className="repository-grid">
        {data.repositories.map((repo) => (
          <button
            className="panel repository-card"
            key={repo.id}
            onClick={() => setSelected(repo)}
          >
            <div>
              <span className="repository-icon">
                <BookOpen size={21} />
              </span>
              <span className="status">
                <LockKeyhole size={10} />
                {repo.private ? "Private" : "Public"}
              </span>
            </div>
            <h2>{repo.name}</h2>
            <p>{repo.description || "No repository description."}</p>
            <div className="repository-metrics">
              <span>
                <GitBranch size={13} />
                {repo.branches.length} branches
              </span>
              <span>
                <GitCommitHorizontal size={13} />
                {repo.commits.length} recent commits
              </span>
            </div>
            <div className="repository-default">
              <code>{repo.defaultBranch}</code>
              <span>
                Explore repository
                <ChevronRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {!data.repositories.length && (
        <div className="panel empty-state">
          <BookOpen size={28} />
          <h3>Your repositories, with context.</h3>
          <p>
            Select GitHub repositories in Connections and complete an import to
            see branches and commits.
          </p>
          <Link
            className="button button-primary"
            href={data.mode === "demo" ? "/demo/connections" : "/connections"}
          >
            Choose repositories
          </Link>
        </div>
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name || "Repository"}
        description={
          selected?.description ||
          "Branches and the latest 30 default-branch commits."
        }
      >
        {selected && (
          <>
            <h3 className="detail-section-title">
              <GitBranch size={15} />
              Branches<span>{selected.branches.length}</span>
            </h3>
            <div className="branch-list">
              {selected.branches.map((branch) => (
                <div className="file-detail" key={branch.name}>
                  <code>{branch.name}</code>
                  {branch.protected && (
                    <span title="Protected branch">
                      <ShieldCheck size={13} />
                    </span>
                  )}
                  <small>{branch.sha.slice(0, 7)}</small>
                </div>
              ))}
            </div>
            <h3 className="detail-section-title">
              <GitCommitHorizontal size={15} />
              Recent commits
            </h3>
            <div className="repository-commits">
              {selected.commits.map((commit) => (
                <div className="commit-detail" key={commit.sha}>
                  <code>{commit.sha.slice(0, 7)}</code>
                  <div>
                    <strong>{commit.message}</strong>
                    <small>{commit.author}</small>
                    <div className="commit-links">
                      {extractIssueKeys(commit.message).map((key) => {
                        const item = data.items.find((i) => i.key === key);
                        return item ? (
                          <button
                            key={key}
                            onClick={() => {
                              setSelected(null);
                              onSelectItem(item);
                            }}
                          >
                            {key}
                            <ChevronRight size={10} />
                          </button>
                        ) : (
                          <span key={key}>{key} · unverified</span>
                        );
                      })}
                    </div>
                  </div>
                  {data.mode === "live" && (
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open commit ${commit.sha.slice(0, 7)}`}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="dialog-footer">
              <span>
                {data.mode === "demo"
                  ? "Sample repository"
                  : "Latest authorized repository snapshot"}
              </span>
              {data.mode === "live" && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="button"
                >
                  Open on GitHub
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
export function SprintView({
  data,
  onSelectItem,
}: {
  data: WorkspaceData;
  onSelectItem: (item: WorkItem) => void;
}) {
  return (
    <>
      <div className="repository-grid">
        {data.sprints.map((sprint) => {
          const items = data.items.filter((i) => i.sprint === sprint.name);
          const done = items.filter((i) => i.status === "Done").length;
          return (
            <section key={sprint.id} className="panel sprint-detail-card">
              <div className="section-heading">
                <span>
                  <Timer size={19} />
                </span>
                <span
                  className={`status ${sprint.state === "active" ? "in-progress" : "to-do"}`}
                >
                  <span />
                  {sprint.state}
                </span>
              </div>
              <h2>{sprint.name}</h2>
              <span className="sprint-board">{sprint.board}</span>
              <p>{sprint.goal || "No sprint goal has been set."}</p>
              {sprint.startDate && (
                <div className="sprint-dates">
                  {new Date(sprint.startDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Kolkata",
                  })}
                  {sprint.endDate &&
                    ` — ${new Date(sprint.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`}
                </div>
              )}
              <div className="sprint-overview-progress">
                <span>
                  {done} of {items.length} imported work items completed
                </span>
                <strong>
                  {items.length ? Math.round((done / items.length) * 100) : 0}%
                </strong>
              </div>
              <div className="progress-bar">
                <span
                  className="done"
                  style={{
                    width: `${items.length ? (done / items.length) * 100 : 0}%`,
                  }}
                />
                <span className="to-do" style={{ flex: 1 }} />
              </div>
              <div className="sprint-work-list">
                {items.map((item) => (
                  <button key={item.id} onClick={() => onSelectItem(item)}>
                    <small>{item.key}</small>
                    <span>{item.title}</span>
                    <ChevronRight size={13} />
                  </button>
                ))}
                {!items.length && (
                  <span>No imported work items assigned yet.</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!data.sprints.length && (
        <div className="panel empty-state">
          <Timer size={28} />
          <h3>No accessible active or future sprints.</h3>
          <p>
            Select Jira projects and complete an import. Scrum boards and Jira
            Software access are required; Kanban boards do not have sprints.
          </p>
          <Link
            className="button button-primary"
            href={data.mode === "demo" ? "/demo/connections" : "/connections"}
          >
            Choose Jira projects
          </Link>
        </div>
      )}
      <p className="evidence-disclaimer">
        Progress reflects imported work items visible to your account. It is not
        a board-wide total when issue security restricts access.
      </p>
    </>
  );
}
