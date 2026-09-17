import { buildCsv } from "@/lib/format";
import type { AssetRow } from "@/lib/types";

type TaskInspection = NonNullable<AssetRow["inspections"]>[number];

/** Every column of the inspection export, in order. */
export const INSPECTION_EXPORT_HEADER = [
  "No",
  "ID-Inventory",
  "Photo URL",
  "Latitude",
  "Longitude",
  "Category",
  "L2",
  "L3",
  "L4",
  "L5",
  "Catalog path",
  "Lain-lain",
  "Price",
  "Condition",
  "Working",
  "Remarks",
  "Inspected at",
];

export interface InspectionExportOptions {
  assets: AssetRow[];
  /** "latest" = one row per marker · "history" = one row per inspection */
  mode?: "latest" | "history";
  /** set false to also list markers that have not been inspected yet */
  skipUninspected?: boolean;
}

function sortBySeq(assets: AssetRow[]): AssetRow[] {
  return [...assets].sort((a, b) =>
    (a.seq_no ?? "").localeCompare(b.seq_no ?? "", undefined, { numeric: true }),
  );
}

export function latestInspection(asset: AssetRow): TaskInspection | null {
  const list = asset.inspections ?? [];
  if (list.length === 0) return null;
  return [...list].sort((x, y) => y.inspected_at.localeCompare(x.inspected_at))[0]!;
}

/** The picked values with their level names: `KETERANGAN: 8M | ARM: 1 ARM …` */
export function catalogPathText(inspection: TaskInspection | null): string {
  return (inspection?.catalog_path ?? [])
    .map((step) => `${step.label ?? `Level ${step.level_no}`}: ${step.value}`)
    .join(" | ");
}

export function buildInspectionExportRow(
  asset: AssetRow,
  inspection: TaskInspection | null,
): Array<string | number | null> {
  return [
    asset.seq_no ?? "",
    asset.inventory_id ?? "",
    inspection?.photo_url ?? "",
    asset.lat ?? "",
    asset.lng ?? "",
    inspection?.asset_category ?? asset.type_text ?? "",
    inspection?.l2 ?? "",
    inspection?.l3 ?? "",
    inspection?.l4 ?? "",
    inspection?.l5 ?? "",
    catalogPathText(inspection),
    inspection?.other_description ?? "",
    inspection?.price ?? asset.price ?? "",
    inspection?.condition ?? "",
    inspection ? (inspection.functional ? "YES" : "NO") : "",
    inspection?.remarks ?? "",
    inspection ? new Date(inspection.inspected_at).toLocaleString() : "",
  ];
}

/**
 * The full inspection export: one row per marker (latest report) or one row per
 * report (history), always with every field of the inspection.
 */
export function buildInspectionCsv(options: InspectionExportOptions): string {
  const { assets, mode = "latest", skipUninspected = true } = options;

  const rows: Array<Array<string | number | null>> = [];

  for (const asset of sortBySeq(assets)) {
    const inspections = [...(asset.inspections ?? [])].sort((x, y) =>
      y.inspected_at.localeCompare(x.inspected_at),
    );

    if (mode === "history") {
      for (const inspection of inspections) {
        rows.push(buildInspectionExportRow(asset, inspection));
      }
      continue;
    }

    if (inspections.length === 0) {
      if (skipUninspected) continue;
      rows.push(buildInspectionExportRow(asset, null));
      continue;
    }

    rows.push(buildInspectionExportRow(asset, inspections[0]!));
  }

  return buildCsv(INSPECTION_EXPORT_HEADER, rows);
}
