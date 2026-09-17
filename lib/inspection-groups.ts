import type { InspectionRow } from "@/lib/types";
import { normalizeCondition } from "@/lib/format";
import { inspectionPhotoCount } from "@/lib/photos";

export interface InspectionTaskGroup {
  /** null = markers that are not part of an imported task */
  taskId: string | null;
  taskName: string;
  rows: InspectionRow[];
  /** how many different markers the group reports on */
  markers: number;
  /** reports that are not working or are in Bad condition */
  needAttention: number;
  /** reports that have at least one photo */
  withPhoto: number;
  /** newest report in the group (ISO) */
  latestAt: string;
}

/**
 * One collapsible block per imported task, newest activity first; markers that
 * never made it into a task are collected under "No task" at the bottom.
 */
export function groupInspectionsByTask(
  rows: InspectionRow[],
): InspectionTaskGroup[] {
  const groups = new Map<string, InspectionTaskGroup>();

  for (const row of rows) {
    const taskId = row.assets?.task_id ?? null;
    const key = taskId ?? "__no_task__";
    let group = groups.get(key);
    if (!group) {
      group = {
        taskId,
        taskName: row.assets?.tasks?.name ?? "No task",
        rows: [],
        markers: 0,
        needAttention: 0,
        withPhoto: 0,
        latestAt: row.inspected_at,
      };
      groups.set(key, group);
    }
    group.rows.push(row);
    if (!row.functional || normalizeCondition(row.condition) === "BAD") {
      group.needAttention += 1;
    }
    if (inspectionPhotoCount(row) > 0) group.withPhoto += 1;
    if (row.inspected_at > group.latestAt) group.latestAt = row.inspected_at;
  }

  const list = [...groups.values()];
  for (const group of list) {
    group.markers = new Set(group.rows.map((row) => row.asset_id)).size;
    /* reports inside a block read newest first */
    group.rows.sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
  }

  return list.sort((a, b) => {
    if (a.taskId === null) return 1;
    if (b.taskId === null) return -1;
    return b.latestAt.localeCompare(a.latestAt);
  });
}
