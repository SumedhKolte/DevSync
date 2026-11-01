import { redirect } from "next/navigation";
import { isConfigured, userClient } from "./supabase";
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
export async function getWorkspaceData(): Promise<WorkspaceData> {
  if (!isConfigured()) throw new Error("Supabase is not configured");
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
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
  ]);
  if (results.some((r) => r.error))
    throw new Error("Workspace data could not be loaded");
  const [workspace, connections, items, prs, links, events] = results;
  const { data: sourceMetadata, error: metadataError } = await db
    .from("source_resources")
    .select("kind,payload")
    .eq("workspace_id", workspaceId);
  if (metadataError) throw new Error("Source metadata could not be loaded");
  const pullRequests = (prs.data || []).map((row) => ({
    ...pullRequestSchema.parse(row.payload),
    id: row.id,
  }));
  const workItems = (items.data || []).map((row) => ({
    ...workItemSchema.parse(row.payload),
    id: row.id,
    pullRequests: pullRequests.filter((pr) =>
      (links.data || []).some(
        (l) => l.work_item_id === row.id && l.pull_request_id === pr.id,
      ),
    ),
  }));
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
