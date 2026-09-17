import { buildCsv } from "@/lib/format";
import type { AssetRow } from "@/lib/types";

type TaskInspection = NonNullable<AssetRow["inspections"]>[number];

/** Every column of the inspection export, in order. */
export const INSPECTION_EXPORT_HEADER = [
  "No",
  "Asset code",
  "ID-Inventory",
  "Task",
  "Location",
  "Asset status",
  "Category",
  "Level 2 value",
  "Level 3 value",
  "Level 4 value",
  "Level 5 value",
  "Level 6 value",
  "Catalog path",
  "Lain-lain",
  "Price",
  "Price source",
  "Condition",
  "Working",
  "Remarks",
  "Inspected at",
  "Inspector",
  "Photo URL",
  "Inspection ID",
  "Reports on this marker",
  "Latitude",
  "Longitude",
];

export interface InspectionExportOptions {
  assets: AssetRow[];
  taskName?: string;
  inspectorNames?: Record<string, string | null>;
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
  options: {
    taskName?: string;
    inspectorNames?: Record<string, string | null>;
    reports?: number;
  } = {},
): Array<string | number | null> {
  const priceSource = !inspection
    ? ""
    : inspection.price_manual
      ? "manual"
      : inspection.price === null || inspection.price === undefined
        ? "none"
        : "catalog";
  const inspector = inspection?.inspector_id
    ? options.inspectorNames?.[inspection.inspector_id] ?? inspection.inspector_id
    : "";

  return [
    asset.seq_no ?? "",
    asset.code ?? "",
    asset.inventory_id ?? "",
    options.taskName ?? asset.tasks?.name ?? "",
    asset.location ?? "",
    asset.status ?? "",
    inspection?.asset_category ?? asset.type_text ?? "",
    inspection?.l2 ?? "",
    inspection?.l3 ?? "",
    inspection?.l4 ?? "",
    inspection?.l5 ?? "",
    inspection?.l6 ?? "",
    catalogPathText(inspection),
    inspection?.other_description ?? "",
    inspection?.price ?? asset.price ?? "",
    priceSource,
    inspection?.condition ?? "",
    inspection ? (inspection.functional ? "YES" : "NO") : "",
    inspection?.remarks ?? "",
    inspection ? new Date(inspection.inspected_at).toLocaleString() : "",
    inspector,
    inspection?.photo_url ?? "",
    inspection?.id ?? "",
    options.reports ?? asset.inspections?.length ?? 0,
    asset.lat ?? "",
    asset.lng ?? "",
  ];
}

/**
 * The full inspection export: one row per marker (latest report) or one row per
 * report (history), always with every field of the inspection.
 */
export function buildInspectionCsv(options: InspectionExportOptions): string {
  const {
    assets,
    taskName,
    inspectorNames,
    mode = "latest",
    skipUninspected = true,
  } = options;

  const rows: Array<Array<string | number | null>> = [];

  for (const asset of sortBySeq(assets)) {
    const inspections = [...(asset.inspections ?? [])].sort((x, y) =>
      y.inspected_at.localeCompare(x.inspected_at),
    );

    if (mode === "history") {
      for (const inspection of inspections) {
        rows.push(
          buildInspectionExportRow(asset, inspection, {
            taskName,
            inspectorNames,
            reports: inspections.length,
          }),
        );
      }
      continue;
    }

    if (inspections.length === 0) {
      if (skipUninspected) continue;
      rows.push(
        buildInspectionExportRow(asset, null, { taskName, inspectorNames, reports: 0 }),
      );
      continue;
    }

    rows.push(
      buildInspectionExportRow(asset, inspections[0]!, {
        taskName,
        inspectorNames,
        reports: inspections.length,
      }),
    );
  }

  return buildCsv(INSPECTION_EXPORT_HEADER, rows);
}
