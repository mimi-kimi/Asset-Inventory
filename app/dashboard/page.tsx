import type { Metadata } from "next";
import { describeError } from "@/lib/format";
import { queryTaskAssets, queryTasks } from "@/lib/queries";
import { requireViewer } from "@/lib/auth";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Map dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";
  const sp = await searchParams;
  const openImport = sp.import === "1";

  let dbError: string | null = null;
  let tasks: Awaited<ReturnType<typeof queryTasks>> = [];
  let assets: Awaited<ReturnType<typeof queryTaskAssets>> = [];
  try {
    [tasks, assets] = await Promise.all([queryTasks(), queryTaskAssets()]);
  } catch (err) {
    dbError = describeError(err);
  }

  if (dbError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <strong>Supabase error:</strong> {dbError}
      </div>
    );
  }

  return (
    <DashboardWorkspace
      tasks={tasks}
      assets={assets}
      isAdmin={isAdmin}
      initialOpenImport={openImport}
    />
  );
}
