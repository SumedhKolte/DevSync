export type WorkStatus = "To do" | "In progress" | "In review" | "Done";
export type CheckState = "passing" | "failing" | "pending" | "unknown";
export interface PullRequest {
  id: string;
  number: number;
  title: string;
  repository: string;
  branch: string;
  state: "open" | "merged" | "closed";
  author: string;
  avatar: string;
  review: "approved" | "changes_requested" | "pending";
  checks: CheckState;
  updatedAt: string;
  url: string;
  additions: number;
  deletions: number;
  commits?: {
    sha: string;
    message: string;
    author: string;
    url: string;
    at: string;
  }[];
  files?: { name: string; additions: number; deletions: number }[];
  body?: string;
  reviewers?: string[];
  workflows?: { name: string; status: string; url: string }[];
}
export interface WorkItem {
  id: string;
  key: string;
  title: string;
  status: WorkStatus;
  sourceStatus?: string;
  type: "Story" | "Bug" | "Task";
  priority: "High" | "Medium" | "Low";
  assignee: string;
  avatar: string;
  project: string;
  description: string;
  pullRequests: PullRequest[];
  updatedAt: string;
  url: string;
  sprint: string | null;
}
export interface Activity {
  id: string;
  kind: "merge" | "review" | "commit" | "issue" | "check";
  actor: string;
  text: string;
  target: string;
  at: string;
  url?: string;
}
export interface Connection {
  id: string;
  provider: "github" | "jira";
  label: string;
  status: "connected" | "error" | "pending";
  lastSync: string | null;
  resources: string[];
  error?: string;
}
export interface WorkspaceData {
  syncRuns: SyncRun[];
  repositories: Repository[];
  sprints: Sprint[];
  asOf: string;
  mode: "demo" | "live";
  workspaceId: string;
  workspaceName: string;
  userName: string;
  items: WorkItem[];
  pullRequests: PullRequest[];
  activities: Activity[];
  connections: Connection[];
  lastSync: string | null;
  sprintName: string;
}
export interface SyncRun {
  id: string;
  connectionId: string;
  status: "queued" | "running" | "complete" | "retrying" | "failed";
  startedAt: string;
  finishedAt: string | null;
  recordsCount: number;
  error: string | null;
}
export interface Repository {
  id: string;
  name: string;
  description: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  branches: { name: string; sha: string; protected: boolean }[];
  commits: {
    sha: string;
    message: string;
    author: string;
    at: string;
    url: string;
  }[];
}
export interface Sprint {
  id: string;
  name: string;
  state: string;
  board: string;
  goal: string;
  startDate?: string;
  endDate?: string;
}
export interface EvidenceSignal {
  id: string;
  rule:
    "failed-checks" | "review-wait" | "unlinked" | "status-drift" | "ambiguous";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  item?: WorkItem;
  pr?: PullRequest;
  observedAt: string;
  sourceUrl: string;
}
