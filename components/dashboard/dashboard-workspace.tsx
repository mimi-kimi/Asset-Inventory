"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Layers, X } from "lucide-react";
import { cn, fmtCoords, fmtDateTime } from "@/lib/format";
import { markerState, MARKER_META } from "@/lib/marker";
import type { AssetRow, TaskRow } from "@/lib/types";
import { Card } from "@/components/ui";
import { MarkersMap, MarkerLegend } from "@/components/map/markers-map";
import type { MapPoint } from "@/components/map/markers-map";
import { createClient } from "@/lib/supabase/client";

const ACTIVE_KEY = "rat-active-task";

function formatPrice(n: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(n);
}

export function DashboardWorkspace({
  tasks,
  assets,
}: {
  tasks: TaskRow[];
  assets: AssetRow[];
}) {
  const [activeTaskId, setActiveTaskId] = useState<string | "all">(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored && tasks.some((t) => t.id === stored)) return stored;
    return tasks[0]?.id ?? "all";
  });
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selected, setSelected] = useState<AssetRow | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  /** fetch full marker detail (incl. latest inspection photo) on click */
  async function selectMarker(id: string) {
    const local = visibleAssets.find((a) => a.id === id) ?? null;
    setSelected(local);
    setLoadingDetail(true);
    try {
      const { data } = await createClient()
        .from("assets")
        .select("*, inspections(id, functional, inspected_at, photo_webp)")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        setSelected({
          ...(data as AssetRow),
          asset_types: local?.asset_types ?? null,
        });
      }
    } catch {
      // keep the lightweight local copy on failure
    } finally {
      setLoadingDetail(false);
    }
  }

  function chooseTask(id: string | "all") {
    setActiveTaskId(id);
    setFitSignal((s) => s + 1);
    if (typeof window !== "undefined") {
      if (id === "all") window.localStorage.removeItem(ACTIVE_KEY);
      else window.localStorage.setItem(ACTIVE_KEY, id);
    }
  }

  const visibleAssets =
    activeTaskId === "all"
      ? assets
      : assets.filter((a) => a.task_id === activeTaskId);

  const points: MapPoint[] = visibleAssets
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
    });

  const stats = (() => {
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
  })();

  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null;

  const latestInspection =
    selected?.inspections && selected.inspections.length > 0
      ? [...selected.inspections].sort((a, b) =>
          b.inspected_at.localeCompare(a.inspected_at),
        )[0]
      : null;
  const photoSrc = latestInspection?.photo_webp ?? selected?.photo_url ?? null;

  return (
    <div className="h-full w-full overflow-y-auto bg-zinc-100 xl:overflow-hidden">
      <div className="flex min-h-full flex-col gap-3 p-3 xl:h-full xl:flex-row xl:gap-0 xl:p-0">
        <div className="flex flex-col gap-3 xl:w-[260px] xl:shrink-0 xl:gap-0 xl:overflow-y-auto xl:border-r xl:border-zinc-200 xl:bg-white">
        <Card className="px-5 py-4 xl:rounded-none xl:border-0 xl:shadow-none xl:border-b xl:border-zinc-100">
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

        <Card className="xl:rounded-none xl:border-0 xl:shadow-none xl:border-b xl:border-zinc-100">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-bold text-zinc-900">Asset distribution</h2>
            <p className="text-xs text-zinc-500">Grouped by Type column</p>
          </div>
          <ul className="max-h-96 space-y-3 overflow-y-auto px-5 py-4 xl:max-h-none">
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

      <div className="flex flex-col gap-3 xl:min-w-0 xl:flex-1 xl:gap-0">
        {/* Collapsible task selector */}
        <Card className="p-2 xl:rounded-none xl:border-0 xl:shadow-none xl:border-b xl:border-zinc-200">
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
              {tasks.length === 0 && (
                <p className="w-full px-2 py-3 text-center text-xs text-zinc-500">
                  No tasks yet.{" "}
                  <Link
                    href="/dashboard/tasks"
                    className="font-semibold text-amber-700 underline"
                  >
                    Open the Task page
                  </Link>{" "}
                  to import markers.
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Map */}
        <Card className="isolate flex min-h-0 flex-1 flex-col overflow-hidden rounded-none xl:border-0 xl:shadow-none">
          <div className="relative min-h-[55vh] flex-1 xl:min-h-0">
            <MarkersMap
              points={points}
              fitSignal={`${activeTaskId}-${fitSignal}`}
              emptyHint={
                tasks.length === 0
                  ? "No tasks yet — import one from the Task page"
                  : "No markers in this selection"
              }
              onSelect={(p) => selectMarker(p.id)}
              selectedId={selected?.id ?? null}
            />

            <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-lg border border-zinc-200 bg-white/95 px-3 py-1.5 shadow-sm">
              <MarkerLegend />
            </div>

            {loadingDetail && (
              <div className="pointer-events-none absolute right-3 top-3 z-[1000] rounded-full bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-white">
                Loading details…
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Selected marker details drawer (desktop) */}
      {selected && (
        <div className="hidden flex-col border-l border-zinc-200 bg-white xl:flex xl:w-[320px] xl:shrink-0 xl:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-bold text-zinc-900">Marker details</h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-48 w-full shrink-0 border-b border-zinc-200 bg-zinc-900">
            {photoSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photoSrc}
                alt="Marker"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-zinc-400">
                <span className="text-3xl">📷</span>
                <span className="text-xs">No photo yet</span>
              </div>
            )}
          </div>

          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Marker · No. {selected.seq_no ?? "—"}
              </p>
              <p className="text-lg font-bold text-zinc-900">
                {selected.inventory_id
                  ? `ID-Inventory: ${selected.inventory_id}`
                  : selected.code || "No ID-Inventory yet"}
              </p>
            </div>

            <dl className="space-y-2.5 border-t border-zinc-100 pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-xs font-semibold text-zinc-400">Price</dt>
                <dd className="font-bold text-zinc-900">
                  {formatPrice(selected.price ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-xs font-semibold text-zinc-400">Type</dt>
                <dd className="truncate text-right text-zinc-700">
                  {selected.type_text || selected.asset_types?.name || "Not set"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-xs font-semibold text-zinc-400">Coordinates</dt>
                <dd className="text-right text-zinc-700">
                  {fmtCoords(selected.lat, selected.lng)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-xs font-semibold text-zinc-400">Status</dt>
                <dd>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-700">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: MARKER_META[markerState(selected)].color }}
                    />
                    {MARKER_META[markerState(selected)].label}
                  </span>
                </dd>
              </div>
              {latestInspection && (
                <div className="flex justify-between gap-3">
                  <dt className="text-xs font-semibold text-zinc-400">Working?</dt>
                  <dd
                    className={`font-semibold ${
                      latestInspection.functional
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {latestInspection.functional ? "Yes" : "No"}
                    <span className="ml-2 font-normal text-zinc-400">
                      {fmtDateTime(latestInspection.inspected_at)}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            {selected.notes && (
              <div className="border-t border-zinc-100 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Remarks
                </p>
                <p className="mt-1 text-sm text-zinc-600">{selected.notes}</p>
              </div>
            )}

            <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-400">
              📱 Field inspection is done in the mobile app.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 xl:w-[280px] xl:shrink-0 xl:gap-0 xl:overflow-y-auto xl:border-l xl:border-zinc-200 xl:bg-white">
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm xl:rounded-none xl:border-0 xl:border-b xl:border-zinc-100 xl:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {activeTaskId === "all" ? "All tasks" : activeTask?.name}
          </p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{stats.total}</p>
          <p className="text-xs text-zinc-500">
            marker{stats.total === 1 ? "" : "s"} in view
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm xl:flex-1 xl:rounded-none xl:border-0 xl:shadow-none">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-bold text-zinc-900">Status of each asset</h2>
            <p className="text-xs text-zinc-500">Summary of the selected tasks</p>
          </div>
          <div className="space-y-3 p-4">
            {(
              [
                ["ok", "Working"],
                ["bad", "Not working"],
                ["todo", "Not yet inspected"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl bg-zinc-50 px-4 py-3"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: MARKER_META[key].color }}
                />
                <span className="flex-1 text-sm font-semibold text-zinc-700">
                  {label}
                </span>
                <span className="text-xl font-bold text-zinc-900">
                  {stats.counts[key]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
