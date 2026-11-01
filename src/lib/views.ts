import type { View } from "@/components/dashboard";
const views: readonly View[] = [
  "overview",
  "work-items",
  "pull-requests",
  "evidence",
  "activity",
  "connections",
  "settings",
  "repositories",
  "sprints",
];
/** Map the optional catch-all route to a dashboard view, or null for a 404. */
export function resolveView(segments: string[] = []) {
  const demo = segments[0] === "demo";
  const paths = demo ? segments.slice(1) : segments;
  const view = paths[0] || "overview";
  if (paths.length > 1 || !views.includes(view as View)) return null;
  return { demo, view: view as View };
}
export const viewTitles: Record<View, string> = {
  overview: "Overview",
  "work-items": "Work items",
  "pull-requests": "Pull requests",
  evidence: "Delivery Evidence",
  activity: "Activity",
  connections: "Connections",
  settings: "Settings",
  repositories: "Repositories",
  sprints: "Sprints",
};
