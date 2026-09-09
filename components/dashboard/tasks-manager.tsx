"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ListChecks, Plus, Trash2 } from "lucide-react";
import { describeError, fmtDate } from "@/lib/format";
import type { AssetRow, TaskRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Card, EmptyState } from "@/components/ui";
import { TaskImportDialog } from "@/components/dashboard/task-import-dialog";

export function TasksManager({
  tasks,
  assets,
  isAdmin,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  const rows = useMemo(
    () =>
      tasks.map((t) => {
        const taskAssets = assets.filter((a) => a.task_id === t.id);
        const inspected = taskAssets.filter(
          (a) => a.inspections && a.inspections.length > 0,
        ).length;
        return { ...t, markers: taskAssets.length, inspected };
      }),
    [tasks, assets],
  );

  async function deleteTask(id: string, name: string) {
    const found = rows.find((r) => r.id === id);
    if (
      !window.confirm(
        `Delete "${name}" and its ${found?.markers ?? 0} markers? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyDelete(id);
    setError("");
    try {
      const { error } = await createClient().from("tasks").delete().eq("id", id);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      setError(describeError(err));
      setBusyDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tasks</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Import CSV/Excel work lists and manage imported batches.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" /> Import a task
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="No tasks imported yet"
            hint={
              isAdmin
                ? "Import a CSV/Excel file with your asset markers to create the first task."
                : "Ask an admin to import a task — it will appear here and on the map."
            }
            action={
              isAdmin ? (
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  <Plus className="h-4 w-4" /> Import a task
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Task</th>
                <th className="px-5 py-3">Imported</th>
                <th className="px-5 py-3">Markers</th>
                <th className="px-5 py-3">Inspected</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-2 font-semibold text-zinc-900">
                      <ListChecks className="h-4 w-4 text-amber-600" />
                      {t.name}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(t.created_at)}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-zinc-700">
                    {t.markers}
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {t.inspected}/{t.markers}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyDelete === t.id}
                        onClick={() => deleteTask(t.id, t.name)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        {busyDelete === t.id ? "…" : "Delete"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
