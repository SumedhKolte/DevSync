"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Activity as ActivityIcon,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDot,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Github,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getEvidence } from "@/lib/evidence";
import type {
  Activity,
  EvidenceSignal,
  PullRequest,
  WorkItem,
  WorkspaceData,
  WorkStatus,
} from "@/lib/types";
import { Button, cn, Modal } from "./ui";
import { RepositoryView, SprintView } from "./source-views";

export type View =
  | "overview"
  | "work-items"
  | "pull-requests"
  | "evidence"
  | "activity"
  | "connections"
  | "settings"
  | "repositories"
  | "sprints";
const nav: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "work-items", label: "Work items", icon: CircleDot },
  { id: "pull-requests", label: "Pull requests", icon: GitPullRequest },
  { id: "evidence", label: "Delivery Evidence", icon: Sparkles },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "repositories", label: "Repositories", icon: GitBranch },
  { id: "sprints", label: "Sprints", icon: Clock3 },
  { id: "connections", label: "Connections", icon: Plug },
];
const statuses: WorkStatus[] = ["To do", "In progress", "In review", "Done"];
const statusClass = (status: string) =>
  status.toLowerCase().replaceAll(" ", "-");
function relative(date: string | null, reference?: string) {
  if (!date) return "Not synced yet";
  const minutes = Math.max(
    0,
    Math.floor(
      (Date.parse(reference || new Date().toISOString()) - Date.parse(date)) /
        60000,
    ),
  );
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
}
function Avatar({
  name,
  initials,
  small = false,
}: {
  name: string;
  initials: string;
  small?: boolean;
}) {
  const color = ["peach", "blue", "lavender", "green"][
    Array.from(name).reduce((a, x) => a + x.charCodeAt(0), 0) % 4
  ];
  return (
    <span className={cn("avatar", color, small && "avatar-small")} title={name}>
      {initials}
    </span>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={cn("status", statusClass(value))}>
      <span />
      {value}
    </span>
  );
}
function CheckStatus({ value }: { value: PullRequest["checks"] }) {
  return (
    <span className={cn("check-state", value)} title={`Checks ${value}`}>
      {value === "passing" ? (
        <CircleCheck size={15} />
      ) : value === "failing" ? (
        <X size={15} />
      ) : value === "pending" ? (
        <Clock3 size={15} />
      ) : (
        <CircleHelp size={15} />
      )}
      <span>
        {value === "passing"
          ? "Passing"
          : value === "failing"
            ? "Failing"
            : value === "pending"
              ? "Pending"
              : "Unknown"}
      </span>
    </span>
  );
}
function ActivityRow({
  activity,
  reference,
}: {
  activity: Activity;
  reference: string;
}) {
  const Icon = {
    merge: GitMerge,
    review: CheckCheck,
    commit: GitCommitHorizontal,
    issue: CircleCheck,
    check: Zap,
  }[activity.kind];
  return (
    <div className="activity-row">
      <span className={cn("activity-mark", activity.kind)}>
        <Icon size={15} />
      </span>
      <div>
        <p>
          <strong>{activity.actor}</strong> {activity.text}
        </p>
        <span>{activity.target}</span>
      </div>
      <time
        suppressHydrationWarning
        title={new Date(activity.at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}
      >
        {relative(activity.at, reference)}
      </time>
    </div>
  );
}
export function Dashboard({ data, view }: { data: WorkspaceData; view: View }) {
  const router = useRouter();
  const prefix = data.mode === "demo" ? "/demo" : "";
  const href = (id: View) => `${prefix}${id === "overview" ? "/" : `/${id}`}`;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [repository, setRepository] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sprint, setSprint] = useState("all");
  const [tab, setTab] = useState<"items" | "prs">("items");
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(null);
  const [command, setCommand] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [onlySaved, setOnlySaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [severity, setSeverity] = useState("all");
  const [issueType, setIssueType] = useState("all");
  const [prState, setPrState] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [checkFilter, setCheckFilter] = useState("all");
  const signals = useMemo(
    () => getEvidence(data, Date.parse(data.asOf)),
    [data],
  );
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  useEffect(() => {
    try {
      setSaved(
        JSON.parse(
          localStorage.getItem(`devsync:saved:${data.workspaceId}`) || "[]",
        ),
      );
    } catch {
      /* corrupt preferences are safely ignored */
    }
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [data.workspaceId]);
  useEffect(() => {
    setPage(0);
  }, [
    query,
    status,
    assignee,
    repository,
    sprint,
    onlySaved,
    issueType,
    prState,
    reviewFilter,
    checkFilter,
    tab,
    view,
  ]);
  useEffect(() => {
    if (data.mode !== "live") return;
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [data.mode, router]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  const toggleSaved = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((x) => x !== id)
      : [...saved, id];
    setSaved(next);
    localStorage.setItem(
      `devsync:saved:${data.workspaceId}`,
      JSON.stringify(next),
    );
  };
  const filtered = useMemo(
    () =>
      data.items.filter(
        (item) =>
          `${item.key} ${item.title} ${item.assignee}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (status === "all" || item.status === status) &&
          (assignee === "all" || item.assignee === assignee) &&
          (repository === "all" ||
            item.pullRequests.some((p) => p.repository === repository)) &&
          (sprint === "all" || item.sprint === sprint) &&
          (!onlySaved || saved.includes(item.id)) &&
          (issueType === "all" || item.type === issueType),
      ),
    [
      data.items,
      query,
      status,
      assignee,
      repository,
      sprint,
      onlySaved,
      saved,
      issueType,
    ],
  );
  const filteredPrs = data.pullRequests.filter(
    (pr) =>
      `${pr.title} ${pr.number} ${pr.repository} ${pr.author}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (repository === "all" || pr.repository === repository) &&
      (assignee === "all" || pr.author === assignee) &&
      (prState === "all" || pr.state === prState) &&
      (reviewFilter === "all" || pr.review === reviewFilter) &&
      (checkFilter === "all" || pr.checks === checkFilter),
  );
  const openPrs = data.pullRequests.filter((p) => p.state === "open");
  const knownChecks = openPrs.filter(
    (p) => p.checks === "passing" || p.checks === "failing",
  );
  const checkRate = knownChecks.length
    ? Math.round(
        (knownChecks.filter((p) => p.checks === "passing").length /
          knownChecks.length) *
          100,
      )
    : null;
  const complete = data.items.filter((i) => i.status === "Done").length;
  const sprintItems =
    data.sprintName === "Current work"
      ? data.items
      : data.items.filter((i) => i.sprint === data.sprintName);
  const sprintComplete = sprintItems.filter((i) => i.status === "Done").length;
  const repositories = [...new Set(data.pullRequests.map((p) => p.repository))];
  const people = [
    ...new Set([
      ...data.items.map((i) => i.assignee),
      ...data.pullRequests.map((p) => p.author),
    ]),
  ];
  const columns = useMemo<ColumnDef<WorkItem>[]>(
    () => [
      {
        accessorKey: "key",
        header: "Work item",
        cell: ({ row }) => (
          <button
            className="work-title"
            onClick={() => setSelected(row.original)}
          >
            <span className={cn("issue-type", row.original.type.toLowerCase())}>
              {row.original.type === "Bug" ? (
                <CircleDot size={14} />
              ) : row.original.type === "Story" ? (
                <Bookmark size={13} />
              ) : (
                <Check size={13} />
              )}
            </span>
            <span>
              <small>{row.original.key}</small>
              <strong>{row.original.title}</strong>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <Status value={getValue<string>()} />,
      },
      {
        id: "pr",
        header: "Pull request",
        cell: ({ row }) => {
          const pr = row.original.pullRequests[0];
          return pr ? (
            <button
              className={cn("pr-tag", pr.state)}
              onClick={() => setSelectedPr(pr)}
            >
              {pr.state === "merged" ? (
                <GitMerge size={13} />
              ) : (
                <GitPullRequest size={13} />
              )}
              #{pr.number}
              {row.original.pullRequests.length > 1 &&
                ` +${row.original.pullRequests.length - 1}`}
            </button>
          ) : (
            <span className="muted">—</span>
          );
        },
      },
      {
        id: "checks",
        header: "Checks",
        cell: ({ row }) =>
          row.original.pullRequests[0] ? (
            <CheckStatus value={row.original.pullRequests[0].checks} />
          ) : (
            <span className="muted">—</span>
          ),
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        cell: ({ row }) => (
          <Avatar
            name={row.original.assignee}
            initials={row.original.avatar}
            small
          />
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const showPrs =
    view === "pull-requests" || (view === "overview" && tab === "prs");
  const refresh = async () => {
    if (data.mode === "demo") {
      startTransition(() => router.refresh());
      setNotice(
        "Demo refreshed. Connect your accounts to sync real development activity.",
      );
      return;
    }
    try {
      const result = await fetch("/api/sync", { method: "POST" });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setNotice(
        "Refresh queued. The worker will import the latest authorized records.",
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not queue refresh.");
    }
  };
  const tableSection = (
    <section className="panel work-panel">
      <div className="panel-title-row">
        <div className="table-tabs">
          <button
            className={!showPrs ? "active" : ""}
            onClick={() => {
              setTab("items");
              if (view === "pull-requests") router.push(href("work-items"));
            }}
          >
            Work items <span>{data.items.length}</span>
          </button>
          <button
            className={showPrs ? "active" : ""}
            onClick={() => {
              setTab("prs");
              if (view === "work-items") router.push(href("pull-requests"));
            }}
          >
            Pull requests <span>{data.pullRequests.length}</span>
          </button>
        </div>
        <button
          className="icon-button"
          aria-label="Open table help"
          onClick={() => setHelp(true)}
        >
          <MoreHorizontal size={19} />
        </button>
      </div>
      <div className="filter-bar">
        <label className="search-input">
          <Search size={15} />
          <input
            aria-label="Search work items and pull requests"
            placeholder={
              showPrs ? "Search pull requests..." : "Search work items..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        {!showPrs && (
          <label className="filter-select">
            <SlidersHorizontal size={13} />
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Status</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
        )}
        <label className="filter-select repo-filter">
          <GitBranch size={13} />
          <select
            aria-label="Filter by repository"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
          >
            <option value="all">Repository</option>
            {repositories.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="filter-select people-filter">
          <select
            aria-label="Filter by assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="all">Assignee</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>
        {!showPrs && (
          <label className="filter-select">
            <select
              aria-label="Filter by issue type"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              <option value="all">Type</option>
              {["Story", "Bug", "Task"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
        )}
        {showPrs && (
          <>
            <label className="filter-select">
              <select
                aria-label="Filter by PR state"
                value={prState}
                onChange={(e) => setPrState(e.target.value)}
              >
                <option value="all">State</option>
                {["open", "merged", "closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="filter-select">
              <select
                aria-label="Filter by review status"
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value)}
              >
                <option value="all">Review</option>
                <option value="pending">Awaiting review</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes requested</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="filter-select">
              <select
                aria-label="Filter by check result"
                value={checkFilter}
                onChange={(e) => setCheckFilter(e.target.value)}
              >
                <option value="all">Checks</option>
                {["passing", "failing", "pending", "unknown"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <ChevronDown size={12} />
            </label>
          </>
        )}
        {!showPrs && (
          <button
            className={cn("icon-button saved-filter", onlySaved && "is-saved")}
            title="Show bookmarked work items"
            aria-label="Show bookmarked work items"
            aria-pressed={onlySaved}
            onClick={() => setOnlySaved((v) => !v)}
          >
            <Bookmark size={15} />
          </button>
        )}
      </div>
      <div className="table-scroll">
        {showPrs ? (
          <table className="data-table pr-table">
            <thead>
              <tr>
                <th>Pull request</th>
                <th>State</th>
                <th>Review</th>
                <th>Checks</th>
                <th>Author</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrs.slice(page * 8, page * 8 + 8).map((pr) => (
                <tr key={pr.id}>
                  <td>
                    <button
                      className="work-title"
                      onClick={() => setSelectedPr(pr)}
                    >
                      <GitPullRequest size={15} />
                      <span>
                        <small>
                          {pr.repository} · #{pr.number}
                        </small>
                        <strong>{pr.title}</strong>
                      </span>
                    </button>
                  </td>
                  <td>
                    <Status value={pr.state} />
                  </td>
                  <td>
                    <span className="review-state">
                      {pr.review === "approved"
                        ? "Approved"
                        : pr.review === "changes_requested"
                          ? "Changes requested"
                          : "Awaiting review"}
                    </span>
                  </td>
                  <td>
                    <CheckStatus value={pr.checks} />
                  </td>
                  <td>
                    <Avatar name={pr.author} initials={pr.avatar} small />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th key={header.id}>
                      {header.column.getCanSort() ? (
                        <button
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ArrowDownUp size={10} />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table
                .getRowModel()
                .rows.slice(page * 8, page * 8 + 8)
                .map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
      {(showPrs ? filteredPrs : filtered).length === 0 && (
        <div className="empty-state">
          <Search size={24} />
          <h3>No matching {showPrs ? "pull requests" : "work items"}</h3>
          <p>
            {data.items.length
              ? "Try another search or clear your filters."
              : "Connect your accounts and select resources to start importing."}
          </p>
          <Button
            onClick={() => {
              setQuery("");
              setStatus("all");
              setRepository("all");
              setAssignee("all");
              setOnlySaved(false);
              setIssueType("all");
              setPrState("all");
              setReviewFilter("all");
              setCheckFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <div className="table-footer">
        <span>
          Showing{" "}
          {Math.min(page * 8 + 1, (showPrs ? filteredPrs : filtered).length)}–
          {Math.min((page + 1) * 8, (showPrs ? filteredPrs : filtered).length)}{" "}
          of {(showPrs ? filteredPrs : filtered).length}{" "}
          {showPrs ? "pull requests" : "work items"}
        </span>
        <div>
          <span>
            Page {page + 1} of{" "}
            {Math.max(
              1,
              Math.ceil((showPrs ? filteredPrs : filtered).length / 8),
            )}
          </span>
          <button
            className="icon-button"
            disabled={page === 0}
            aria-label="Previous page"
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="icon-button"
            disabled={
              (page + 1) * 8 >= (showPrs ? filteredPrs : filtered).length
            }
            aria-label="Next page"
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
  const signalCard = (signal: EvidenceSignal) => (
    <button
      key={signal.id}
      className="signal-card"
      onClick={() =>
        signal.item
          ? setSelected(signal.item)
          : signal.pr && setSelectedPr(signal.pr)
      }
    >
      <span className={cn("signal-dot", signal.severity)} />
      <div>
        <h3>{signal.title}</h3>
        <p>{signal.description}</p>
        <span>
          {signal.item?.key || `PR #${signal.pr?.number}`}
          <ArrowUpRight size={11} />
          <span className="signal-severity">
            {signal.severity === "high"
              ? "Needs attention"
              : signal.severity === "medium"
                ? "Review suggested"
                : "Improve traceability"}
          </span>
        </span>
      </div>
      <ChevronRight size={14} />
    </button>
  );
  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={cn("sidebar", mobileNav && "mobile-open")}>
        <Link className="brand" href={href("overview")}>
          <span className="brand-symbol">
            <GitBranch size={21} />
          </span>
          devsync<span className="brand-dot">.</span>
        </Link>
        <button className="workspace-switch" onClick={() => setHelp(true)}>
          <span className="workspace-icon">A</span>
          <span>
            <strong>{data.workspaceName}</strong>
            <small>
              {data.mode === "demo" ? "Demo workspace" : "Private workspace"}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setCommand(true)}>
          <Search size={15} />
          <span>Quick search</span>
          <kbd>⌘ K</kbd>
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={href(id)}
              onClick={() => {
                setMobileNav(false);
                setQuery("");
                setPage(0);
              }}
              className={cn("nav-item", view === id && "active")}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "evidence" && signals.length > 0 && (
                <span className="nav-count">{signals.length}</span>
              )}
              {id === "connections" && <span className="connection-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-projects">
          <span className="nav-label">CONNECTED SOURCES</span>
          {data.connections.length ? (
            data.connections.map((c) => (
              <Link
                href={href("connections")}
                className="source-item"
                key={c.id}
              >
                {c.provider === "github" ? (
                  <Github size={15} />
                ) : (
                  <span className="jira-symbol">◆</span>
                )}
                <span>{c.provider === "github" ? "GitHub" : "Jira Cloud"}</span>
                <span
                  className={cn(
                    "connection-dot",
                    c.status !== "connected" && "warning",
                  )}
                />
              </Link>
            ))
          ) : (
            <Link href={href("connections")} className="source-item">
              <Plus size={15} />
              Add a connection
            </Link>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <ShieldCheck size={17} />
            </span>
            <strong>Clarity, without the tab hopping.</strong>
            <p>
              Your code and your plans.
              <br />
              Finally on the same page.
            </p>
            <button onClick={() => setHelp(true)}>
              Explore DevSync <ArrowUpRight size={12} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>Help & documentation</span>
            <ArrowUpRight size={12} />
          </button>
          <Link
            href={href("settings")}
            className={cn("nav-item", view === "settings" && "active")}
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </Link>
          <div className="profile">
            <Avatar
              name={data.userName}
              initials={data.userName
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            />
            <span>
              <strong>{data.userName}</strong>
              <small>
                {data.mode === "demo" ? "Demo account" : "Workspace owner"}
              </small>
            </span>
            {data.mode === "live" ? (
              <form action="/auth/signout" method="post">
                <button title="Sign out" className="icon-button">
                  <Unplug size={15} />
                </button>
              </form>
            ) : (
              <Link href="/login" title="Sign in" className="icon-button">
                <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {nav.find((n) => n.id === view)?.label || "Settings"}
            </strong>
          </div>
          <div>
            <span className="demo-pill">
              <span />
              {data.mode === "demo" ? "Demo mode" : "Live workspace"}
            </span>
            <span className="top-divider" />
            <button
              className="icon-button"
              aria-label="Open documentation"
              onClick={() => setHelp(true)}
            >
              <BookOpen size={17} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label={`View ${signals.length} delivery signals`}
              onClick={() => router.push(href("evidence"))}
            >
              <Bell size={17} />
              {signals.length > 0 && <i />}
            </button>
            <Avatar
              name={data.userName}
              initials={data.userName
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
              small
            />
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {data.mode === "demo"
                  ? "YOUR CONNECTED WORKSPACE"
                  : "ENGINEERING WORKSPACE"}
              </div>
              <h1>
                {view === "overview"
                  ? "A little clarity. A lot of progress."
                  : nav.find((n) => n.id === view)?.label ||
                    "Workspace settings"}
                {view === "evidence" && (
                  <span className="beta-label">SIGNALS</span>
                )}
              </h1>
              <p>
                {view === "overview"
                  ? "Everything your team is building, connected in one place."
                  : view === "work-items"
                    ? "From the plan to the pull request. Follow every piece of work."
                    : view === "pull-requests"
                      ? "Reviews, checks, and the work behind every change."
                      : view === "evidence"
                        ? "Catch the gaps between planned work and development reality."
                        : view === "repositories"
                          ? "Branches, commits, and the work behind your repositories."
                          : view === "sprints"
                            ? "Sprint goals and the authorized work moving them forward."
                            : view === "connections"
                              ? "Bring your tools together. Keep your team in sync."
                              : view === "activity"
                                ? "A shared timeline of the work moving your team forward."
                                : "Make this workspace work for you."}
              </p>
            </div>
            <div className="heading-actions">
              {["overview", "work-items"].includes(view) && (
                <label className="button sprint-select">
                  <Clock3 size={14} />
                  <select
                    aria-label="Select sprint"
                    value={sprint}
                    onChange={(e) => setSprint(e.target.value)}
                  >
                    <option value="all">All work</option>
                    {[
                      ...new Set(
                        data.items.map((i) => i.sprint).filter(Boolean),
                      ),
                    ].map((s) => (
                      <option key={s} value={s!}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} />
                </label>
              )}
              <Button onClick={refresh} disabled={pending}>
                <RefreshCw size={14} className={pending ? "spin" : ""} />
                {pending ? "Refreshing" : "Refresh"}
              </Button>
            </div>
          </div>
          {view === "overview" && (
            <>
              <div className="connection-banner">
                <div className="connection-art">
                  <span>
                    <Github size={22} />
                  </span>
                  <span className="connector-line">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="jira-art">◆</span>
                </div>
                <div>
                  <strong>Two tools. One shared picture.</strong>
                  <p>
                    {data.mode === "demo"
                      ? "Explore a sample team’s delivery workflow. Your real workspace is one connection away."
                      : "Your selected repositories and projects, with the context that connects them."}
                  </p>
                </div>
                <Link href={href("connections")}>
                  {data.mode === "demo"
                    ? "Connect your tools"
                    : "Manage connections"}
                  <ArrowRight size={14} />
                </Link>
              </div>
              <div className="stats-grid">
                {[
                  {
                    label: "Open work items",
                    value: data.items.length - complete,
                    icon: CircleDot,
                    class: "blue",
                    detail: `${complete} completed work items`,
                    href: href("work-items"),
                  },
                  {
                    label: "Open pull requests",
                    value: openPrs.length,
                    icon: GitPullRequest,
                    class: "lavender",
                    detail: `${openPrs.filter((p) => p.review === "pending").length} waiting for review`,
                    href: href("pull-requests"),
                  },
                  {
                    label: "Passing checks",
                    value: checkRate === null ? "—" : `${checkRate}%`,
                    icon: CircleCheck,
                    class: "green",
                    detail: `${knownChecks.filter((p) => p.checks === "passing").length} of ${knownChecks.length} resolved check results`,
                    href: href("pull-requests"),
                  },
                  {
                    label: "Delivery signals",
                    value: signals.length,
                    icon: Sparkles,
                    class: "amber",
                    detail: `${signals.filter((s) => s.severity === "high").length} need your attention`,
                    href: href("evidence"),
                  },
                ].map((metric) => (
                  <Link
                    href={metric.href}
                    className="stat-card"
                    key={metric.label}
                  >
                    <div>
                      <span>{metric.label}</span>
                      <span className={cn("stat-icon", metric.class)}>
                        <metric.icon size={16} />
                      </span>
                    </div>
                    <strong>{metric.value}</strong>
                    <p>
                      <span className={cn("metric-dot", metric.class)} />
                      {metric.detail}
                      <ArrowUpRight size={13} />
                    </p>
                  </Link>
                ))}
              </div>
              <div className="dashboard-grid">
                <div className="dashboard-primary">
                  {tableSection}
                  <div className="bottom-grid">
                    <DeliveryPulse
                      activities={data.activities}
                      reference={data.asOf}
                    />
                    <section className="panel recent-panel">
                      <div className="section-heading">
                        <h2>Recent activity</h2>
                        <Link href={href("activity")}>
                          View all
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                      {data.activities.slice(0, 3).map((a) => (
                        <ActivityRow
                          key={a.id}
                          activity={a}
                          reference={data.asOf}
                        />
                      ))}
                      {!data.activities.length && (
                        <p className="panel-empty">
                          Activity appears after your first import.
                        </p>
                      )}
                    </section>
                  </div>
                </div>
                <aside className="dashboard-secondary">
                  <section className="panel evidence-panel">
                    <div className="evidence-heading">
                      <span className="evidence-icon">
                        <Sparkles size={17} />
                      </span>
                      <div>
                        <h2>Delivery Evidence</h2>
                        <p>Small signals. Better decisions.</p>
                      </div>
                      <span className="signal-count">{signals.length}</span>
                    </div>
                    <div className="evidence-summary">
                      <span className="live-dot" />{" "}
                      {signals.length
                        ? `${signals.length} things worth a closer look`
                        : "No delivery gaps detected"}
                    </div>
                    {signals.slice(0, 4).map(signalCard)}
                    <Link href={href("evidence")} className="evidence-footer">
                      Explore all evidence
                      <ArrowRight size={14} />
                    </Link>
                  </section>
                  <section className="panel sprint-card">
                    <div className="section-heading">
                      <h2>{data.sprintName}</h2>
                      <span className="sprint-label">Current</span>
                    </div>
                    <p>A little closer to the finish line.</p>
                    <div className="sprint-completion">
                      <strong>
                        {sprintItems.length
                          ? Math.round(
                              (sprintComplete / sprintItems.length) * 100,
                            )
                          : 0}
                        <small>%</small>
                      </strong>
                      <span>
                        {sprintComplete} of {sprintItems.length} completed
                      </span>
                    </div>
                    <div className="progress-bar">
                      {statuses.map((s) => (
                        <span
                          key={s}
                          className={statusClass(s)}
                          style={{
                            width: `${sprintItems.length ? (sprintItems.filter((i) => i.status === s).length / sprintItems.length) * 100 : 0}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="sprint-legend">
                      {["Done", "In review", "In progress", "To do"].map(
                        (s) => (
                          <span key={s}>
                            <i className={statusClass(s)} />
                            {s}
                            <b>
                              {sprintItems.filter((i) => i.status === s).length}
                            </b>
                          </span>
                        ),
                      )}
                    </div>
                  </section>
                  <div className="sync-footnote">
                    <RefreshCw size={12} />
                    <span>
                      {data.mode === "demo" ? "Sample data · " : ""}Last synced{" "}
                      {relative(data.lastSync, data.asOf)}
                    </span>
                    <span className="connection-dot" />
                  </div>
                </aside>
              </div>
            </>
          )}
          {(view === "work-items" || view === "pull-requests") && tableSection}
          {view === "evidence" && (
            <>
              <div className="evidence-intro">
                <ShieldCheck size={27} />
                <div>
                  <h2>Every signal has a source.</h2>
                  <p>
                    Evidence is based on explicit links, current check results,
                    and observed workflow states. It suggests a review; it never
                    changes Jira automatically.
                  </p>
                </div>
              </div>
              <div className="evidence-filter">
                <div className="segmented">
                  {["all", "high", "medium", "low"].map((s) => (
                    <button
                      key={s}
                      className={severity === s ? "active" : ""}
                      onClick={() => setSeverity(s)}
                    >
                      {s === "all"
                        ? "All signals"
                        : s === "high"
                          ? "Needs attention"
                          : s === "medium"
                            ? "Review suggested"
                            : "Traceability"}
                      <span>
                        {
                          signals.filter((x) => s === "all" || x.severity === s)
                            .length
                        }
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="evidence-grid">
                {signals
                  .filter((s) => severity === "all" || s.severity === severity)
                  .map(signalCard)}
              </div>
              {!signals.filter(
                (s) => severity === "all" || s.severity === severity,
              ).length && (
                <div className="empty-state panel">
                  <CircleCheck size={30} />
                  <h3>All clear in this view</h3>
                  <p>
                    Signals will appear when current development evidence
                    suggests a review.
                  </p>
                </div>
              )}
              <p className="evidence-disclaimer">
                Default rules: review waiting over 48 hours; evidence older than
                7 days is excluded. Unavailable checks remain unknown.
              </p>
            </>
          )}
          {view === "activity" && (
            <section className="panel activity-page">
              <div className="section-heading">
                <h2>Development timeline</h2>
                <label className="search-input">
                  <Search size={15} />
                  <input
                    aria-label="Search activity"
                    placeholder="Search activity..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              {data.activities
                .filter((a) =>
                  `${a.actor} ${a.text} ${a.target}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((a) => (
                  <ActivityRow key={a.id} activity={a} reference={data.asOf} />
                ))}
              {!data.activities.length && (
                <div className="empty-state">
                  <ActivityIcon />
                  <h3>Your story starts here</h3>
                  <p>Connect your tools to see development activity.</p>
                </div>
              )}
            </section>
          )}
          {view === "connections" && (
            <Connections data={data} onNotice={setNotice} />
          )}
          {view === "repositories" && (
            <RepositoryView data={data} onSelectItem={setSelected} />
          )}
          {view === "sprints" && (
            <SprintView data={data} onSelectItem={setSelected} />
          )}
          {view === "settings" && <Settings data={data} onNotice={setNotice} />}
          <footer className="main-footer">
            <span>
              <span className="footer-logo">
                <GitBranch size={13} />
              </span>
              Built for the work between the tools.
            </span>
            <button onClick={() => setHelp(true)}>
              A little help?
              <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      <Modal
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.key || "Work item"}
        description={selected?.title}
        className="detail-dialog"
      >
        {selected && (
          <>
            <div className="detail-meta">
              <Status value={selected.sourceStatus || selected.status} />
              <span className={cn("priority", selected.priority.toLowerCase())}>
                {selected.priority} priority
              </span>
              <button
                className={cn(
                  "button",
                  saved.includes(selected.id) && "is-saved",
                )}
                onClick={() => toggleSaved(selected.id)}
              >
                <Bookmark size={14} />
                {saved.includes(selected.id) ? "Saved" : "Save item"}
              </button>
            </div>
            <p className="detail-description">
              {selected.description || "No description available."}
            </p>
            <div className="detail-properties">
              <span>
                Assignee
                <strong>
                  <Avatar
                    name={selected.assignee}
                    initials={selected.avatar}
                    small
                  />
                  {selected.assignee}
                </strong>
              </span>
              <span>
                Project<strong>{selected.project}</strong>
              </span>
              <span>
                Sprint<strong>{selected.sprint || "No sprint"}</strong>
              </span>
              <span>
                Last observed
                <strong>{relative(selected.updatedAt, data.asOf)}</strong>
              </span>
            </div>
            <h3 className="detail-section-title">
              <Link2 size={15} />
              Connected development<span>{selected.pullRequests.length}</span>
            </h3>
            {selected.pullRequests.length ? (
              selected.pullRequests.map((pr) => (
                <button
                  className="linked-pr"
                  key={pr.id}
                  onClick={() => {
                    setSelected(null);
                    setSelectedPr(pr);
                  }}
                >
                  <GitPullRequest size={17} />
                  <div>
                    <small>
                      {pr.repository} · #{pr.number}
                    </small>
                    <strong>{pr.title}</strong>
                  </div>
                  <CheckStatus value={pr.checks} />
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <div className="detail-empty">
                No verified development links yet. Reference {selected.key} in a
                branch, commit, or pull request to connect the work.
              </div>
            )}
            {signals
              .filter((s) => s.item?.id === selected.id)
              .map((s) => (
                <div className="detail-signal" key={s.id}>
                  <TriangleAlert size={16} />
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.description}</p>
                  </div>
                </div>
              ))}
            <div className="dialog-footer">
              <span>
                {data.mode === "demo"
                  ? "Sample work item · no external changes"
                  : "Read-only view · Jira remains the source of truth"}
              </span>
              {data.mode === "live" && (
                <a
                  className="button"
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Jira
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={!!selectedPr}
        onOpenChange={(o) => !o && setSelectedPr(null)}
        title={
          selectedPr ? `Pull request #${selectedPr.number}` : "Pull request"
        }
        description={selectedPr?.title}
      >
        {selectedPr && (
          <>
            <div className="detail-meta">
              <Status value={selectedPr.state} />
              <CheckStatus value={selectedPr.checks} />
              <span className="muted">
                {selectedPr.review.replaceAll("_", " ")}
              </span>
            </div>
            <div className="branch-box">
              <GitBranch size={16} />
              <code>{selectedPr.branch}</code>
            </div>
            <div className="detail-properties">
              <span>
                Repository<strong>{selectedPr.repository}</strong>
              </span>
              <span>
                Author<strong>{selectedPr.author}</strong>
              </span>
              <span>
                Changes
                <strong>
                  <b className="additions">+{selectedPr.additions}</b>
                  <b className="deletions">−{selectedPr.deletions}</b>
                </strong>
              </span>
              <span>
                Last updated
                <strong>{relative(selectedPr.updatedAt, data.asOf)}</strong>
              </span>
            </div>
            {selectedPr.commits?.length ? (
              <details className="detail-collapse">
                <summary>
                  <GitCommitHorizontal size={14} />
                  Commits<span>{selectedPr.commits.length}</span>
                </summary>
                {selectedPr.commits.map((commit) => (
                  <div className="commit-detail" key={commit.sha}>
                    <code>{commit.sha.slice(0, 7)}</code>
                    <div>
                      <strong>{commit.message}</strong>
                      <small>
                        {commit.author} · {relative(commit.at, data.asOf)}
                      </small>
                    </div>
                    {data.mode === "live" && (
                      <a
                        href={commit.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View commit ${commit.sha.slice(0, 7)}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </details>
            ) : null}
            {selectedPr.files?.length ? (
              <details className="detail-collapse">
                <summary>
                  <Code2 size={14} />
                  Changed files<span>{selectedPr.files.length}</span>
                </summary>
                {selectedPr.files.map((file) => (
                  <div className="file-detail" key={file.name}>
                    <code>{file.name}</code>
                    <span className="additions">+{file.additions}</span>
                    <span className="deletions">−{file.deletions}</span>
                  </div>
                ))}
              </details>
            ) : null}
            {selectedPr.workflows?.length ? (
              <details className="detail-collapse">
                <summary>
                  <Zap size={14} />
                  Workflow runs<span>{selectedPr.workflows.length}</span>
                </summary>
                {selectedPr.workflows.map((w, i) => (
                  <div className="file-detail" key={i}>
                    <span>{w.name}</span>
                    <Status value={w.status} />
                    {data.mode === "live" && (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View workflow ${w.name}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                ))}
              </details>
            ) : null}
            <h3 className="detail-section-title">
              <Link2 size={15} />
              Linked work items
            </h3>
            {data.items
              .filter((i) => i.pullRequests.some((p) => p.id === selectedPr.id))
              .map((i) => (
                <button
                  className="linked-pr"
                  key={i.id}
                  onClick={() => {
                    setSelectedPr(null);
                    setSelected(i);
                  }}
                >
                  <span className="jira-symbol">◆</span>
                  <div>
                    <small>{i.key}</small>
                    <strong>{i.title}</strong>
                  </div>
                  <ArrowRight size={14} />
                </button>
              ))}
            {!data.items.some((i) =>
              i.pullRequests.some((p) => p.id === selectedPr.id),
            ) && (
              <p className="detail-empty">
                No verified Jira link. Add a valid issue key to the PR title or
                description to improve traceability.
              </p>
            )}
            <div className="dialog-footer">
              <span>
                {data.mode === "demo"
                  ? "Sample PR · source preview only"
                  : "Checks reflect the latest imported commit"}
              </span>
              {data.mode === "live" && (
                <a
                  className="button"
                  href={selectedPr.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open on GitHub
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={command}
        onOpenChange={setCommand}
        title="Find your focus"
        description="Jump to a view or find a work item."
      >
        <label className="search-input command-search">
          <Search size={18} />
          <input
            autoFocus
            aria-label="Quick search"
            placeholder="Search work items, views..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="command-results">
          {nav
            .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
            .map((n) => (
              <Link
                key={n.id}
                href={href(n.id)}
                onClick={() => {
                  setCommand(false);
                  setQuery("");
                }}
              >
                <n.icon size={17} />
                {n.label}
                <ArrowRight size={14} />
              </Link>
            ))}
          {data.items
            .filter((i) =>
              `${i.key} ${i.title}`.toLowerCase().includes(query.toLowerCase()),
            )
            .slice(0, 6)
            .map((i) => (
              <button
                key={i.id}
                onClick={() => {
                  setCommand(false);
                  setSelected(i);
                  setQuery("");
                }}
              >
                <CircleDot size={16} />
                <span>
                  <small>{i.key}</small>
                  {i.title}
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
        </div>
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="A clearer picture of delivery"
        description="Your quick guide to DevSync."
      >
        <div className="help-content">
          <div>
            <Link2 />
            <h3>Connect the dots</h3>
            <p>
              Put a Jira key like ENG-142 in a PR, branch or commit. DevSync
              validates the reference and brings the records together.
            </p>
          </div>
          <div>
            <Sparkles />
            <h3>Follow the evidence</h3>
            <p>
              Signals explain failing checks, review delays and workflow gaps.
              Open a signal to inspect its linked work. Jira is never updated
              automatically.
            </p>
          </div>
          <div>
            <Command />
            <h3>Find your focus</h3>
            <p>
              Press ⌘K or Ctrl+K to search. Filter tables, open work-item
              details, and bookmark the items you want to revisit.
            </p>
          </div>
          {data.mode === "demo" && (
            <p className="demo-explanation">
              You’re exploring isolated sample data. Sign in with a configured
              Supabase project to connect your own tools.
            </p>
          )}
        </div>
      </Modal>
      {notice && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function DeliveryPulse({
  activities,
  reference,
}: {
  activities: Activity[];
  reference: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(reference);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    return {
      label: date.toLocaleDateString("en", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }),
      events: activities.filter(
        (a) =>
          new Date(a.at).toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
          }) === date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
      ),
    };
  });
  const max = Math.max(4, ...days.map((d) => d.events.length));
  return (
    <section className="panel pulse-panel">
      <div className="section-heading">
        <h2>Delivery pulse</h2>
        <span>Last 7 days</span>
      </div>
      <div className="chart-legend">
        <span>
          <i />
          Commits
        </span>
        <span>
          <i />
          Other activity
        </span>
      </div>
      <div className="pulse-chart">
        <div className="chart-grid-lines">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        {days.map((d, i) => (
          <div className="chart-column" key={i}>
            <div
              className="bar-track"
              title={`${d.label}: ${d.events.filter((e) => e.kind === "commit").length} commits, ${d.events.filter((e) => e.kind !== "commit").length} other events`}
            >
              <span
                className="bar-commits"
                style={{
                  height: `${(d.events.filter((e) => e.kind === "commit").length / max) * 100}%`,
                }}
              />
              <span
                className="bar-other"
                style={{
                  height: `${(d.events.filter((e) => e.kind !== "commit").length / max) * 100}%`,
                }}
              />
            </div>
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Connections({
  data,
  onNotice,
}: {
  data: WorkspaceData;
  onNotice: (s: string) => void;
}) {
  const router = useRouter();
  const [disconnect, setDisconnect] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<string | null>(null);
  const [resources, setResources] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const configureScope = async (id: string) => {
    if (data.mode === "demo") {
      onNotice(
        "Sample connections are read-only. Sign in to select your own repositories and projects.",
      );
      return;
    }
    setScope(id);
    setBusy(true);
    try {
      const r = await fetch(`/api/connections/${id}/resources`);
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setResources(b.resources);
      setChosen(b.selected);
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not load resources");
      setScope(null);
    } finally {
      setBusy(false);
    }
  };
  const saveScope = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/connections/${scope}/resources`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resources: chosen }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setScope(null);
      onNotice("Selection saved. Initial import has been queued.");
      router.refresh();
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not save selection");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="connections-grid">
        {(["github", "jira"] as const).map((provider) => {
          const connection = data.connections.find(
            (c) => c.provider === provider,
          );
          return (
            <section className="panel integration-card" key={provider}>
              <div className="integration-card-top">
                <span className={cn("provider-logo", provider)}>
                  {provider === "github" ? <Github size={32} /> : "◆"}
                </span>
                {connection && (
                  <span
                    className={cn(
                      "status",
                      connection.status === "connected"
                        ? "done"
                        : "in-progress",
                    )}
                  >
                    <span />
                    {data.mode === "demo"
                      ? "Sample connection"
                      : connection.status === "connected"
                        ? "Connected"
                        : connection.status === "error"
                          ? "Needs attention"
                          : "Select resources"}
                  </span>
                )}
              </div>
              <h2>{provider === "github" ? "GitHub" : "Jira Cloud"}</h2>
              <p>
                {provider === "github"
                  ? "Pull requests, commits, reviews, and CI checks. The whole development story."
                  : "Projects, work items, and sprints. The plan behind every line of code."}
              </p>
              {connection ? (
                <>
                  <div className="integration-account">
                    <strong>{connection.label}</strong>
                    <span>
                      Last synced {relative(connection.lastSync, data.asOf)}
                    </span>
                  </div>
                  <div className="resource-list">
                    {connection.resources.length ? (
                      connection.resources.map((r) => (
                        <span key={r}>
                          {provider === "github" ? (
                            <GitBranch size={13} />
                          ) : (
                            <CircleDot size={13} />
                          )}
                          {r}
                        </span>
                      ))
                    ) : (
                      <p>No resources selected yet.</p>
                    )}
                  </div>
                  {connection.error && (
                    <div className="connection-error">{connection.error}</div>
                  )}
                  <div className="integration-actions">
                    <Button onClick={() => configureScope(connection.id)}>
                      <SlidersHorizontal size={14} />
                      Manage scope
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        data.mode === "demo"
                          ? onNotice(
                              "Sample data is isolated. Sign in to manage real connections.",
                            )
                          : setDisconnect(connection.id)
                      }
                    >
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="integration-permissions">
                    <ShieldCheck size={15} />
                    <span>Read-only access to selected resources</span>
                  </div>
                  <a
                    className="button button-primary"
                    href={`/api/connect/${provider}`}
                  >
                    <Plus size={15} />
                    Connect {provider === "github" ? "GitHub" : "Jira"}
                  </a>
                </>
              )}
            </section>
          );
        })}
      </div>
      {data.mode === "demo" && (
        <div className="setup-callout">
          <div>
            <h3>Ready for your own workspace?</h3>
            <p>
              Configure Supabase, sign in, and authorize your GitHub and Jira
              accounts. Demo records stay separate.
            </p>
          </div>
          <Link className="button button-primary" href="/login">
            Set up workspace
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <section className="panel sync-details">
        <div className="section-heading">
          <h2>How synchronization works</h2>
          <ShieldCheck size={18} />
        </div>
        <div className="sync-steps">
          <div>
            <span>01</span>
            <h3>You choose the scope</h3>
            <p>Select the repositories and Jira projects you want to follow.</p>
          </div>
          <div>
            <span>02</span>
            <h3>We follow the changes</h3>
            <p>
              Background imports, authenticated webhooks, and reconciliation
              keep the picture current.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>You stay in control</h3>
            <p>
              Review source evidence. No automatic Jira transitions or code
              changes.
            </p>
          </div>
        </div>
      </section>
      <Modal
        open={!!disconnect}
        onOpenChange={(o) => !o && setDisconnect(null)}
        title="Disconnect this account?"
        description="Imported records, credentials and sync history for this connection will be removed from DevSync. Source records remain unchanged."
      >
        <div className="dialog-footer">
          <Button onClick={() => setDisconnect(null)}>Keep connection</Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch(`/api/connections/${disconnect}`, {
                  method: "DELETE",
                });
                if (!r.ok)
                  throw new Error("Disconnect failed. Please try again.");
                setDisconnect(null);
                onNotice("Connection and imported data removed.");
                router.refresh();
              } catch (e) {
                onNotice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Disconnect and remove data
          </Button>
        </div>
      </Modal>
      <Modal
        open={!!scope}
        onOpenChange={(o) => !o && setScope(null)}
        title="Choose your scope"
        description="Only selected resources will be imported. Changes remove records that leave the selected scope."
      >
        {busy ? (
          <div className="empty-state">
            <LoaderCircle className="spin" />
            Loading resources…
          </div>
        ) : (
          <div className="scope-options">
            {resources.map((r) => (
              <label key={r.id}>
                <input
                  type="checkbox"
                  checked={chosen.includes(r.id)}
                  onChange={() =>
                    setChosen((c) =>
                      c.includes(r.id)
                        ? c.filter((x) => x !== r.id)
                        : [...c, r.id],
                    )
                  }
                />
                {r.name}
              </label>
            ))}
          </div>
        )}
        <div className="dialog-footer">
          <span>{chosen.length} selected</span>
          <Button variant="primary" disabled={busy} onClick={saveScope}>
            Save and import
          </Button>
        </div>
      </Modal>
    </>
  );
}
function Settings({
  data,
  onNotice,
}: {
  data: WorkspaceData;
  onNotice: (s: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(data.workspaceName);
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel settings-panel">
      <h2>Workspace details</h2>
      <p>A familiar name for your team’s connected work.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (data.mode === "demo") {
            onNotice(
              "Demo workspace settings are read-only. Sign in to create your own workspace.",
            );
            return;
          }
          setBusy(true);
          try {
            const r = await fetch("/api/workspace", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            if (!r.ok) throw new Error("Could not update workspace");
            onNotice("Workspace updated.");
            router.refresh();
          } catch (e) {
            onNotice((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Workspace name
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button variant="primary" type="submit" disabled={busy}>
          Save changes
        </Button>
      </form>
      <div className="settings-divider" />
      <h2>Privacy by default</h2>
      <p>
        This version keeps imported source data private to the person who
        authorized the connection. Sharing a workspace does not grant access to
        private repositories or restricted Jira work items.
      </p>
      <div className="privacy-feature">
        <ShieldCheck size={18} />
        Read-only provider access
      </div>
      <div className="privacy-feature">
        <ShieldCheck size={18} />
        Encrypted provider credentials
      </div>
      <div className="privacy-feature">
        <ShieldCheck size={18} />
        Isolated demo and live workspaces
      </div>
      <div className="settings-divider" />
      <h2>Evidence rules</h2>
      <p>
        Reviews are flagged after 48 hours without a PR update. Observations
        older than 7 days are excluded from evidence. Team-configurable
        thresholds are planned; this release uses these explicit defaults.
      </p>
    </section>
  );
}
