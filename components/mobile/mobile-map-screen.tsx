"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Layers, X } from "lucide-react";
import { cn } from "@/lib/format";
import { MARKER_META, markerState } from "@/lib/marker";
import type { AssetRow, TaskRow } from "@/lib/types";
import { MarkersMap, MarkerLegend } from "@/components/map/markers-map";
import type { MapPoint } from "@/components/map/markers-map";

const ACTIVE_KEY = "rat-active-task";

export function MobileMapScreen({
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<AssetRow | null>(null);
  const [fitSignal, setFitSignal] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_KEY, activeTaskId);
  }, [activeTaskId]);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  const visibleAssets = useMemo(
    () => (activeTask ? assets.filter((a) => a.task_id === activeTask.id) : []),
    [assets, activeTask],
  );

  const points: MapPoint[] = useMemo(
    () =>
      visibleAssets
        .filter((a) => a.lat != null && a.lng != null)
        .map((a) => ({
          id: a.id,
          label: a.seq_no || a.inventory_id || a.code,
          sub: a.inventory_id ? `ID ${a.inventory_id}` : "No ID yet",
          lat: a.lat as number,
          lng: a.lng as number,
          state: markerState(a),
        })),
    [visibleAssets],
  );

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <p className="text-3xl">🗺️</p>
        <p className="font-bold text-zinc-900">No tasks yet</p>
        <p className="text-sm text-zinc-500">
          Ask your admin to import a task list. The markers will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left"
        >
          <Layers className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="truncate text-sm font-bold text-zinc-800">
            {activeTask?.name ?? "Task"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        <span className="shrink-0 text-xs font-semibold text-zinc-500">
          {visibleAssets.length} markers
        </span>
      </div>

      {pickerOpen && (
        <div className="max-h-52 overflow-y-auto border-b border-zinc-200 bg-white px-3 py-2">
          {tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTaskId(t.id);
                setPickerOpen(false);
                setSelected(null);
                setFitSignal((s) => s + 1);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm",
                t.id === activeTaskId ? "bg-amber-50" : "hover:bg-zinc-50",
              )}
            >
              <span className="min-w-0 truncate font-semibold text-zinc-800">
                {t.name}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">{t.row_count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1">
        <MarkersMap
          points={points}
          fitSignal={`${activeTaskId}-${fitSignal}`}
          onSelect={(p) =>
            setSelected(visibleAssets.find((a) => a.id === p.id) ?? null)
          }
          selectedId={selected?.id ?? null}
          className="h-full w-full"
        />

        <div className="absolute left-3 top-3 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 shadow-sm">
          <MarkerLegend />
        </div>

        {selected && (
          <div className="absolute inset-x-3 bottom-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Marker · No. {selected.seq_no ?? "—"}
                  </p>
                  <p className="truncate text-lg font-bold text-zinc-900">
                    {selected.inventory_id
                      ? `ID-Inventory: ${selected.inventory_id}`
                      : "No ID-Inventory yet"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {selected.type_text || selected.asset_types?.name || "Type not set"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: MARKER_META[markerState(selected)].color }}
                  />
                  {MARKER_META[markerState(selected)].label}
                </span>
                <Link
                  href={`/mobile/record/upsert?asset=${selected.id}`}
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 active:scale-95"
                >
                  {markerState(selected) === "todo" ? "Inspect" : "Edit"}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
