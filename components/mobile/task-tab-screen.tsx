"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, History, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/format";
import { markerState, MARKER_META } from "@/lib/marker";
import { downloadFile } from "@/lib/format";
import { exportInspectionsCsv } from "@/lib/actions/export";
import type { AssetRow, TaskRow } from "@/lib/types";
import { Card } from "@/components/ui";

const ACTIVE_KEY = "rat-active-task";

export function TaskTabScreen({
  tasks,
  assets,
  canExport,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
  /** exporting a task's CSV / the report history is an admin tool */
  canExport: boolean;
}) {
  const [activeTaskId, setActiveTaskId] = useState<string>(() => {
    if (typeof window === "undefined") return tasks[0]?.id ?? "";
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && tasks.some((t) => t.id === stored)) return stored;
    return tasks[0]?.id ?? "";
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const taskAssets = useMemo(
    () => assets.filter((a) => a.task_id === activeTaskId),
    [assets, activeTaskId],
  );

  const inspected = useMemo(
    () =>
      taskAssets.filter((a) => a.inspections && a.inspections.length > 0),
    [taskAssets],
  );

  function pickTask(id: string) {
    setActiveTaskId(id);
    window.localStorage.setItem(ACTIVE_KEY, id);
  }

  /* ---------- export: every field of the inspection ---------- */
  const taskName = tasks.find((t) => t.id === activeTaskId)?.name ?? "";
  const historyCount = inspected.reduce(
    (total, asset) => total + (asset.inspections?.length ?? 0),
    0,
  );

  function filenameBase() {
    return (taskName || "task").replace(/[^\w-]+/g, "_");
  }

  /** both exports are built by the server action (admins only) */
  async function runExport(mode: "latest" | "history") {
    if (!activeTaskId) return;
    setExporting(true);
    setError("");
    try {
      const res = await exportInspectionsCsv({ taskId: activeTaskId, mode });
      if (!res.ok || !res.csv) {
        setError(res.error ?? "Could not build the export.");
        return;
      }
      downloadFile(
        res.filename ?? `${filenameBase()}-${mode === "history" ? "history" : "inspected"}.csv`,
        res.csv,
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3 px-4 pt-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Tasks</h1>
        <p className="text-sm text-zinc-500">Pick which task to work on today.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-6 text-center text-sm text-zinc-500">
          No tasks imported yet.
        </Card>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const count = assets.filter((a) => a.task_id === t.id).length;
            const done = assets.filter(
              (a) => a.task_id === t.id && a.inspections?.length,
            ).length;
            const active = t.id === activeTaskId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => pickTask(t.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-colors",
                    active
                      ? "border-amber-500 bg-amber-50"
                      : "border-zinc-200 hover:border-zinc-300",
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100">
                    {active ? (
                      <CheckCircle2 className="h-5 w-5 text-amber-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-zinc-300" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-zinc-900">
                      {t.name}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {done}/{count} inspected · imported {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {activeTaskId && !canExport && (
        <p className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-500">
          Exporting is done by an admin — on a computer, open the dashboard and use{" "}
          <span className="font-semibold text-zinc-600">Tasks → Export</span>.
        </p>
      )}

      {activeTaskId && canExport && (
        <div className="space-y-2">
          <p className="px-1 text-xs text-zinc-500">
            The CSV covers this task’s reports from every account, including photos
            and prices.
          </p>
          <button
            type="button"
            onClick={() => void runExport("latest")}
            disabled={exporting || inspected.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Preparing…" : `Export inspected data (${inspected.length}) as CSV`}
          </button>
          <button
            type="button"
            onClick={() => void runExport("history")}
            disabled={exporting || historyCount === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-bold text-zinc-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
          >
            <History className="h-4 w-4" />
            Export full history ({historyCount} report{historyCount === 1 ? "" : "s"})
          </button>
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          {inspected.length === 0 && (
            <p className="rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
              Nothing to export yet — the export lists the markers of this task that
              already have a report. Inspect one from the Map tab and it appears here.
            </p>
          )}
        </div>
      )}

      {/* summary of current task */}
      {activeTaskId && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Task summary
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {(["todo", "ok", "bad"] as const).map((s) => {
              const n = taskAssets.filter((a) => markerState(a) === s).length;
              return (
                <div key={s} className="rounded-lg bg-zinc-50 py-2">
                  <p className="text-lg font-bold text-zinc-900">{n}</p>
                  <p className="text-[10px] font-semibold text-zinc-500">
                    {MARKER_META[s].label}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
