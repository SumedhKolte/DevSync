import { z } from "zod";
import type { Json } from "./database.types";
export const sourceUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Source links must use HTTPS without embedded credentials.");
export const resourceSchema = z.object({ id: z.string(), name: z.string() });
export const pullRequestSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  repository: z.string(),
  branch: z.string(),
  state: z.enum(["open", "merged", "closed"]),
  author: z.string(),
  avatar: z.string(),
  review: z.enum(["approved", "changes_requested", "pending"]),
  checks: z.enum(["passing", "failing", "pending", "unknown"]),
  updatedAt: z.string(),
  url: sourceUrlSchema,
  additions: z.number(),
  deletions: z.number(),
  body: z.string().optional(),
  commits: z
    .array(
      z.object({
        sha: z.string(),
        message: z.string(),
        author: z.string(),
        url: sourceUrlSchema,
        at: z.string(),
      }),
    )
    .optional(),
  files: z
    .array(
      z.object({
        name: z.string(),
        additions: z.number(),
        deletions: z.number(),
      }),
    )
    .optional(),
  reviewers: z.array(z.string()).optional(),
  workflows: z
    .array(
      z.object({ name: z.string(), status: z.string(), url: sourceUrlSchema }),
    )
    .optional(),
});
export const workItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  status: z.enum(["To do", "In progress", "In review", "Done"]),
  sourceStatus: z.string().optional(),
  type: z.enum(["Story", "Bug", "Task"]),
  priority: z.enum(["High", "Medium", "Low"]),
  assignee: z.string(),
  avatar: z.string(),
  project: z.string(),
  description: z.string(),
  pullRequests: z.array(pullRequestSchema).default([]),
  updatedAt: z.string(),
  url: sourceUrlSchema,
  sprint: z.string().nullable(),
});
export const activitySchema = z.object({
  id: z.string(),
  kind: z.enum(["merge", "review", "commit", "issue", "check"]),
  actor: z.string(),
  text: z.string(),
  target: z.string(),
  at: z.string(),
  url: sourceUrlSchema.optional(),
});
export const connectionSchema = z.object({
  id: z.uuid(),
  workspace_id: z.uuid(),
  owner_id: z.uuid(),
  provider: z.enum(["github", "jira"]),
  provider_account_id: z.string(),
  scope_version: z.number(),
  resources: z.array(resourceSchema),
  config: z.object({
    cloud_id: z.string().optional(),
    site_url: sourceUrlSchema.optional(),
    installation_id: z.number().optional(),
    webhook_ids: z.array(z.number()).optional(),
    webhook_expires_at: z.number().optional(),
    webhook_scope: z.string().optional(),
  }),
});
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}
export const repositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  defaultBranch: z.string(),
  private: z.boolean(),
  url: sourceUrlSchema,
  branches: z.array(
    z.object({ name: z.string(), sha: z.string(), protected: z.boolean() }),
  ),
  commits: z.array(
    z.object({
      sha: z.string(),
      message: z.string(),
      author: z.string(),
      at: z.string(),
      url: sourceUrlSchema,
    }),
  ),
});
export const sprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  board: z.string(),
  goal: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
