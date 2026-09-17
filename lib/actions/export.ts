"use server";

import { getViewer } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { buildInspectionCsv } from "@/lib/inspection-export";
import { canExportData } from "@/lib/roles";
import { TASK_ASSET_COLUMNS } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { AssetRow } from "@/lib/types";

export interface ExportResult {
  ok: boolean;
  error?: string;
  /** suggested file name, e.g. `Task_2-history.csv` */
  filename?: string;
  csv?: string;
}

function fileBase(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "task";
}

/**
 * Builds a task's inspection CSV **on the server**. Exporting is an admin
 * capability, so the phone has no export UI and this check also covers anyone
 * calling the action directly.
 */
export async function exportInspectionsCsv(input: {
  taskId: string;
  /** "latest" = one row per marker · "history" = one row per report */
  mode: "latest" | "history";
  /** true also lists markers that have no report yet (the task checklist) */
  includeUninspected?: boolean;
}): Promise<ExportResult> {
  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "You are not signed in." };
    if (!canExportData(viewer.profile.role)) {
      return { ok: false, error: "Only administrators can export the reports." };
    }
    if (!input.taskId) return { ok: false, error: "Pick a task first." };

    const supabase = await createClient();
    const [{ data: assets, error }, { data: task }] = await Promise.all([
      supabase
        .from("assets")
        .select(TASK_ASSET_COLUMNS)
        .eq("task_id", input.taskId)
        .limit(20000),
      supabase.from("tasks").select("id, name").eq("id", input.taskId).maybeSingle(),
    ]);
    if (error) throw error;

    const csv = buildInspectionCsv({
      assets: (assets ?? []) as AssetRow[],
      mode: input.mode,
      skipUninspected: !input.includeUninspected,
    });

    return {
      ok: true,
      filename: `${fileBase((task as { name?: string | null } | null)?.name)}-${
        input.mode === "history" ? "history" : "inspections"
      }.csv`,
      csv,
    };
  } catch (err) {
    return { ok: false, error: describeError(err, "Could not build the export.") };
  }
}
