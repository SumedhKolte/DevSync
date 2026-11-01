import { notFound } from "next/navigation";
import { Dashboard, type View } from "@/components/dashboard";
import { getDemoData } from "@/lib/demo";
import { getWorkspaceData } from "@/lib/server/data";
import { isConfigured } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view: segments = [] } = await params;
  const demo = segments[0] === "demo";
  const paths = demo ? segments.slice(1) : segments;
  const view = paths[0] || "overview";
  if (
    paths.length > 1 ||
    ![
      "overview",
      "work-items",
      "pull-requests",
      "evidence",
      "activity",
      "connections",
      "settings",
      "repositories",
      "sprints",
    ].includes(view)
  )
    notFound();
  const data =
    demo || !isConfigured() ? getDemoData() : await getWorkspaceData();
  return <Dashboard data={data} view={view as View} />;
}
