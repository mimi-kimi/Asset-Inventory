"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Layers, X } from "lucide-react";
import { cn, fmtDateTime } from "@/lib/format";
import { MARKER_META, markerState } from "@/lib/marker";
import { latestInspection } from "@/lib/inspection-export";
import { canEditInspection } from "@/lib/roles";
import type { AssetRow, TaskRow } from "@/lib/types";
import { MarkersMap, MarkerLegend } from "@/components/map/markers-map";
import type { MapPoint } from "@/components/map/markers-map";

const ACTIVE_KEY = "rat-active-task";

export function MobileMapScreen({
  tasks,
  assets,
  meId,
  isAdmin,
  inspectorNames,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
  /** the signed-in user — reports by other people are read-only here */
  meId: string;
  isAdmin: boolean;
  inspectorNames: Record<string, string | null>;
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

  /** newest report of the tapped marker — the drawer edits that one */
  const selectedReport = selected ? latestInspection(selected) : null;
  /* everyone can see every report, but a report belongs to its author */
  const reportAuthorId = selectedReport?.inspector_id ?? "";
  const reportMine = Boolean(selectedReport) && reportAuthorId === meId;
  const reportAuthor = selectedReport
    ? reportMine
      ? "you"
      : reportAuthorId
        ? (inspectorNames[reportAuthorId] ?? "another user")
        : "another user"
    : null;
  const canEditReport = Boolean(
    selectedReport &&
      canEditInspection({
        inspectorId: reportAuthorId,
        meId,
        isAdmin,
      }),
  );

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
          label: a.seq_no || a.inventory_id || "No ID-Inventory",
          sub: a.inventory_id ? `ID ${a.inventory_id}` : "No ID-Inventory",
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
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] flex-col">
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

        <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 shadow-sm">
          <MarkerLegend vertical />
        </div>

        {selected && (
          <div className="absolute inset-x-3 bottom-4 z-[1000]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Marker · No. {selected.seq_no ?? "—"}
                  </p>
                  <p className="truncate text-lg font-bold text-zinc-900">
                    {selected.inventory_id
                      ? `ID-Inventory: ${selected.inventory_id}`
                      : "No ID-Inventory"}
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
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Price
                  </dt>
                  <dd className="font-bold text-zinc-900">
                    {selected.price != null
                      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(selected.price)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Category
                  </dt>
                  <dd className="truncate text-zinc-700">
                    {selected.type_text || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Coordinates
                  </dt>
                  <dd className="text-zinc-700">
                    {selected.lat != null && selected.lng != null
                      ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Status
                  </dt>
                  <dd>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: MARKER_META[markerState(selected)].color }}
                      />
                      {MARKER_META[markerState(selected)].label}
                    </span>
                  </dd>
                </div>
                {selectedReport && (
                  <div className="col-span-2">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Last report
                    </dt>
                    <dd className="text-zinc-700">
                      {reportAuthor === "you" ? "Yours" : `By ${reportAuthor}`} ·{" "}
                      {fmtDateTime(selectedReport.inspected_at)}
                    </dd>
                  </div>
                )}
              </dl>
              {selected.notes && (
                <p className="mt-2 line-clamp-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-400">Remarks: </span>
                  {selected.notes}
                </p>
              )}
              {selectedReport && !canEditReport && (
                <p className="mt-3 rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
                  Reported by {reportAuthor}. Only {reportAuthor === "you" ? "you" : "they"}{" "}
                  (or an admin) can change that report — add a new one instead.
                </p>
              )}
              {canEditReport ? (
                <>
                  <Link
                    href={`/mobile/record/upsert?inspection=${selectedReport!.id}`}
                    className="mt-3 flex w-full items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 active:scale-[0.99]"
                  >
                    Edit this report
                  </Link>
                  <Link
                    href={`/mobile/record/upsert?asset=${selected.id}`}
                    className="mt-2 flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 active:scale-[0.99]"
                  >
                    Add a new report
                  </Link>
                </>
              ) : selectedReport ? (
                <Link
                  href={`/mobile/record/upsert?asset=${selected.id}`}
                  className="mt-2 flex w-full items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 active:scale-[0.99]"
                >
                  Add a new report
                </Link>
              ) : (
                <Link
                  href={`/mobile/record/upsert?asset=${selected.id}`}
                  className="mt-3 flex w-full items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 active:scale-[0.99]"
                >
                  Inspect this marker
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
