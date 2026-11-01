import { redirect } from "next/navigation";
import { currentUser, isConfigured, userClient } from "./supabase";
import type { Connection, WorkspaceData } from "../types";
import {
  activitySchema,
  connectionSchema,
  pullRequestSchema,
  resourceSchema,
  workItemSchema,
  repositorySchema,
  sprintSchema,
} from "../validation";
import { z } from "zod";
import { attachPullRequests } from "../delivery";
export async function getWorkspaceData(): Promise<WorkspaceData> {
  if (!isConfigured()) throw new Error("Supabase is not configured");
  const db = await userClient();
  const user = await currentUser();
  if (!user) redirect("/login");
  const { data: workspaceId, error: bootstrapError } =
    await db.rpc("ensure_workspace");
  if (bootstrapError) throw new Error("Workspace schema unavailable");
  const results = await Promise.all([
    db.from("workspaces").select("*").eq("id", workspaceId).single(),
    db.from("connections").select("*").eq("workspace_id", workspaceId),
    db
      .from("work_items")
      .select("id,payload,connection_id")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    db
      .from("pull_requests")
      .select("id,payload,connection_id")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    db
      .from("development_links")
      .select("work_item_id,pull_request_id")
      .eq("workspace_id", workspaceId),
    db
      .from("activity_events")
      .select("id,payload")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    db
      .from("source_resources")
      .select("kind,payload")
      .eq("workspace_id", workspaceId),
    db
      .from("sync_runs")
      .select(
        "id,connection_id,status,started_at,finished_at,records_count,error",
      )
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(30),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Workspace data could not be loaded");
  const [workspace, connections, items, prs, links, events, metadata, runs] =
    results;
  const sourceMetadata = metadata.data;
  const pullRequests = (prs.data || []).map((row) => ({
    ...pullRequestSchema.parse(row.payload),
    id: row.id,
  }));
  const workItems = attachPullRequests(
    (items.data || []).map((row) => ({
      ...workItemSchema.parse(row.payload),
      id: row.id,
      pullRequests: [],
    })),
    pullRequests,
    links.data || [],
  );
  const activeConnections: Connection[] = (connections.data || []).map((c) => ({
    id: c.id,
    provider: connectionSchema.shape.provider.parse(c.provider),
    label: c.label,
    status: z.enum(["connected", "error", "pending"]).parse(c.status),
    lastSync: c.last_sync_at,
    resources: z
      .array(resourceSchema)
      .parse(c.resources)
      .map((r) => r.name),
    error: c.last_error || undefined,
  }));
  const syncTimes = activeConnections
    .map((c) => c.lastSync)
    .filter((s): s is string => !!s)
    .sort();
  const sprints = (sourceMetadata || [])
    .filter((r) => r.kind === "sprint")
    .map((r) => sprintSchema.parse(r.payload));
  return {
    mode: "live",
    syncRuns: (runs.data || []).map((run) => ({
      id: run.id,
      connectionId: run.connection_id,
      status: z
        .enum(["queued", "running", "complete", "retrying", "failed"])
        .parse(run.status),
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      recordsCount: run.records_count,
      error: run.error,
    })),
    repositories: (sourceMetadata || [])
      .filter((r) => r.kind === "repository")
      .map((r) => repositorySchema.parse(r.payload)),
    sprints,
    asOf: new Date().toISOString(),
    workspaceId,
    workspaceName: workspace.data!.name,
    userName:
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined) ||
      user.email?.split("@")[0] ||
      "Your account",
    items: workItems,
    pullRequests,
    activities: (events.data || []).map((row) => ({
      ...activitySchema.parse(row.payload),
      id: row.id,
    })),
    connections: activeConnections,
    lastSync: syncTimes[0] || null,
    sprintName:
      sprints.find((s) => s.state === "active")?.name || "Current work",
  };
}
