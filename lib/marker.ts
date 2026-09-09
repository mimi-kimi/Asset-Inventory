import type { AssetRow } from "@/lib/types";

/** Marker/inspection state for map coloring. */
export type MarkerState = "todo" | "ok" | "bad";

export const MARKER_META: Record<
  MarkerState,
  { color: string; label: string; emoji: string }
> = {
  todo: { color: "#3b82f6", label: "Not yet inspected", emoji: "🔵" },
  ok: { color: "#22c55e", label: "Working", emoji: "🟢" },
  bad: { color: "#ef4444", label: "Not working", emoji: "🔴" },
};

export function isInspected(asset: AssetRow | null | undefined): boolean {
  return Boolean(asset?.inspections && asset.inspections.length > 0);
}

/** Latest inspection decides the color: ok/green or bad/red; none = todo/blue. */
export function markerState(asset: AssetRow | null | undefined): MarkerState {
  const inspections = asset?.inspections;
  if (!inspections || inspections.length === 0) return "todo";
  const latest = inspections.reduce((a, b) =>
    a.inspected_at >= b.inspected_at ? a : b,
  );
  return latest.functional ? "ok" : "bad";
}
