import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getDemoData } from "@/lib/demo";
import { getWorkspaceData } from "@/lib/server/data";
import { resolveView } from "@/lib/views";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const route = resolveView((await params).view);
  if (!route) notFound();
  const data = route.demo ? getDemoData() : await getWorkspaceData();
  return <Dashboard data={data} view={route.view} />;
}
