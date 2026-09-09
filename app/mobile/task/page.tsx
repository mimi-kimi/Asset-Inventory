import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { queryTaskAssets, queryTasks } from "@/lib/queries";
import { TaskTabScreen } from "@/components/mobile/task-tab-screen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tasks" };

export default async function MobileTaskPage() {
  await requireViewer();

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
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <strong>Supabase error:</strong> {dbError}
      </div>
    );
  }

  return <TaskTabScreen tasks={tasks} assets={assets} />;
}
