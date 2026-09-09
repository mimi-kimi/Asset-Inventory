"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Layers, Plus, X } from "lucide-react";
import { cn } from "@/lib/format";
import { markerState, MARKER_META } from "@/lib/marker";
import type { AssetRow, TaskRow } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui";
import { MarkersMap, MarkerLegend } from "@/components/map/markers-map";
import type { MapPoint } from "@/components/map/markers-map";
import { TaskImportDialog } from "@/components/dashboard/task-import-dialog";

const ACTIVE_KEY = "rat-active-task";

function formatPrice(n: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
}

export function DashboardWorkspace({
  tasks,
  assets,
  isAdmin,
  initialOpenImport,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
  isAdmin: boolean;
  initialOpenImport: boolean;
}) {
  const [activeTaskId, setActiveTaskId] = useState<string | "all">(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && tasks.some((t) => t.id === stored)) return stored;
    return tasks[0]?.id ?? "all";
  });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(initialOpenImport);
  const [selected, setSelected] = useState<AssetRow | null>(null);
  const [fitSignal, setFitSignal] = useState(0);

  /* task import event from the header button */
  useEffect(() => {
    function handler() {
      setImportOpen(true);
    }
    window.addEventListener("rat:open-import", handler);
    return () => window.removeEventListener("rat:open-import", handler);
  }, []);

  function chooseTask(id: string | "all") {
    setActiveTaskId(id);
    setFitSignal((s) => s + 1);
    if (typeof window !== "undefined") {
      if (id === "all") window.localStorage.removeItem(ACTIVE_KEY);
      else window.localStorage.setItem(ACTIVE_KEY, id);
    }
  }

  const visibleAssets = useMemo(() => {
    if (activeTaskId === "all") return assets;
    return assets.filter((a) => a.task_id === activeTaskId);
  }, [assets, activeTaskId]);

  const points: MapPoint[] = useMemo(
    () =>
      visibleAssets
        .filter((a) => a.lat != null && a.lng != null)
        .map((a) => {
          const state = markerState(a);
          return {
            id: a.id,
            label: a.seq_no || a.inventory_id || a.code,
            sub: a.inventory_id ? `${a.inventory_id}` : undefined,
            lat: a.lat as number,
            lng: a.lng as number,
            state,
          };
        }),
    [visibleAssets],
  );

  const stats = useMemo(() => {
    let price = 0;
    const counts = { todo: 0, ok: 0, bad: 0 };
    const dist = new Map<string, { count: number; price: number }>();
    for (const a of visibleAssets) {
      const s = markerState(a);
      counts[s] += 1;
      const p = a.price ?? 0;
      price += p;
      const key = a.type_text?.trim() || a.asset_types?.name?.trim() || "Uncategorised";
      const entry = dist.get(key) ?? { count: 0, price: 0 };
      entry.count += 1;
      entry.price += p;
      dist.set(key, entry);
    }
    const distribution = [...dist.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count);
    return { price, counts, distribution, total: visibleAssets.length };
  }, [visibleAssets]);

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <EmptyState
            title="No imported tasks yet"
            hint={
              isAdmin
                ? "Import a CSV/Excel file (with longitude & latitude) to drop markers on the map."
                : "Ask an admin to import a task — the markers will appear here."
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
        <TaskImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <div className="order-2 space-y-4 xl:order-1">
        <Card className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Total price
            {activeTask ? ` · ${activeTask.name}` : " · all tasks"}
          </p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">
            {formatPrice(stats.price)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {stats.total} marker{stats.total === 1 ? "" : "s"}
            {activeTaskId === "all"
              ? ` across ${tasks.length} task${tasks.length === 1 ? "" : "s"}`
              : " in this task"}
          </p>
        </Card>

        <Card>
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-bold text-zinc-900">Asset distribution</h2>
            <p className="text-xs text-zinc-500">Grouped by Type column</p>
          </div>
          <ul className="max-h-96 space-y-3 overflow-y-auto px-5 py-4">
            {stats.distribution.length === 0 && (
              <li className="py-6 text-center text-sm text-zinc-400">
                No assets for this selection.
              </li>
            )}
            {stats.distribution.map((d) => {
              const maxCount = Math.max(1, stats.distribution[0]?.count ?? 1);
              return (
                <li key={d.name}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium text-zinc-700">
                      {d.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-zinc-500">
                      {d.count} · {formatPrice(d.price)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.round((d.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="order-1 space-y-3 xl:order-2">
        {/* Collapsible task selector */}
        <Card className="p-2">
          <button
            type="button"
            onClick={() => setSelectorOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-zinc-50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="truncate text-sm">
                <span className="font-semibold text-zinc-900">
                  {activeTaskId === "all"
                    ? "All tasks"
                    : activeTask?.name ?? "Select task"}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {activeTaskId === "all"
                    ? `${tasks.length} tasks`
                    : `${activeTask?.row_count ?? stats.total} markers`}
                </span>
              </span>
            </span>
            {selectorOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-zinc-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
            )}
          </button>
          {selectorOpen && (
            <div className="mt-1 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto border-t border-zinc-100 px-2 pt-2">
              <button
                type="button"
                onClick={() => chooseTask("all")}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                  activeTaskId === "all"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                )}
              >
                All ({tasks.length})
              </button>
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => chooseTask(t.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                    activeTaskId === t.id
                      ? "bg-amber-500 text-zinc-950"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                  )}
                >
                  {t.name} ({t.row_count})
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Map */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
            <MarkerLegend />
            <span className="text-xs font-semibold text-zinc-500">
              <span className="text-red-600">{stats.counts.bad}</span> ·{" "}
              <span className="text-green-600">{stats.counts.ok}</span> ·{" "}
              <span className="text-blue-600">{stats.counts.todo}</span>
            </span>
          </div>
          <div className="relative h-[62vh] min-h-[440px]">
            <MarkersMap
              points={points}
              fitSignal={`${activeTaskId}-${fitSignal}`}
              onSelect={(p) =>
                setSelected(visibleAssets.find((a) => a.id === p.id) ?? null)
              }
              selectedId={selected?.id ?? null}
            />

            {selected && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 w-[min(94%,460px)] -translate-x-1/2">
                <div className="pointer-events-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        Marker · No. {selected.seq_no ?? "—"}
                      </p>
                      <p className="truncate text-lg font-bold text-zinc-900">
                        {selected.inventory_id
                          ? `ID-Inventory: ${selected.inventory_id}`
                          : selected.code}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {selected.type_text || selected.asset_types?.name || "Type not set"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="pointer-events-auto rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: MARKER_META[markerState(selected)].color }}
                      />
                      {MARKER_META[markerState(selected)].label}
                    </span>
                    <Link
                      href={`/mobile/record/upsert?asset=${selected.id}`}
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                    >
                      {markerState(selected) === "todo" ? "Inspect" : "Edit"}
                      <CheckCircle2 className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="order-3">
        <Card>
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-bold text-zinc-900">Status of each asset</h2>
            <p className="text-xs text-zinc-500">
              {activeTaskId === "all" ? "All tasks" : activeTask?.name}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-zinc-100 px-4 py-3">
            {(["todo", "ok", "bad"] as const).map((s) => (
              <div key={s} className="rounded-lg bg-zinc-50 px-2 py-2 text-center">
                <p className="text-xl font-bold text-zinc-900">{stats.counts[s]}</p>
                <p className="text-[11px] font-semibold text-zinc-500">
                  {MARKER_META[s].label}
                </p>
              </div>
            ))}
          </div>
          <ul className="max-h-[46vh] divide-y divide-zinc-100 overflow-y-auto">
            {visibleAssets.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-zinc-400">
                No assets for this selection.
              </li>
            )}
            {visibleAssets.slice(0, 200).map((a) => {
              const s = markerState(a);
              const meta = MARKER_META[s];
              return (
                <li key={a.id} className="flex items-center gap-2.5 px-4 py-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-800">
                      {a.seq_no || a.inventory_id || a.code}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {a.inventory_id ? `ID: ${a.inventory_id} · ` : ""}
                      {a.type_text || a.asset_types?.name || "Type not set"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-zinc-500">
                    {meta.emoji}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      </div>

      <TaskImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
