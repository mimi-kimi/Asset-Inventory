"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import { cn } from "@/lib/format";
import { markerState, MARKER_META } from "@/lib/marker";
import { downloadFile } from "@/lib/format";
import type { AssetRow, TaskRow } from "@/lib/types";
import { Card } from "@/components/ui";

const ACTIVE_KEY = "rat-active-task";

export function TaskTabScreen({
  tasks,
  assets,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
}) {
  const [activeTaskId, setActiveTaskId] = useState<string>(() => {
    if (typeof window === "undefined") return tasks[0]?.id ?? "";
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && tasks.some((t) => t.id === stored)) return stored;
    return tasks[0]?.id ?? "";
  });

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

  function exportCsv() {
    const header = [
      "No",
      "ID-Inventory",
      "Type",
      "Remarks",
      "Price",
      "Working",
      "Inspected At",
      "Latitude",
      "Longitude",
    ];
    const esc = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = inspected.map((a) => {
      const latest = a.inspections
        ? [...a.inspections].sort((x, y) =>
            y.inspected_at.localeCompare(x.inspected_at),
          )[0]
        : null;
      return [
        a.seq_no,
        a.inventory_id,
        a.type_text || a.asset_types?.name || "",
        a.notes,
        a.price,
        latest ? (latest.functional ? "YES" : "NO") : "",
        latest ? new Date(latest.inspected_at).toLocaleString() : "",
        a.lat,
        a.lng,
      ]
        .map(esc)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const task = tasks.find((t) => t.id === activeTaskId);
    downloadFile(
      `${(task?.name ?? "task").replace(/[^\w-]+/g, "_")}-inspected.csv`,
      csv,
    );
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

      {inspected.length > 0 && (
        <button
          type="button"
          onClick={exportCsv}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white active:scale-[0.99]"
        >
          <Download className="h-4 w-4" />
          Export inspected data ({inspected.length}) as CSV
        </button>
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
