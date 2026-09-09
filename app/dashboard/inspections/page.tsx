import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryInspections, fetchInspectorNames } from "@/lib/queries";
import { CONDITION_META, describeError, fmtDateTime } from "@/lib/format";
import type { InspectionRow } from "@/lib/types";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inspections" };

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ condition?: string; functional?: string }>;
}) {
  await requireViewer();
  const sp = await searchParams;
  const conditionFilter =
    typeof sp.condition === "string" && sp.condition !== ""
      ? sp.condition
      : null;
  const functionalFilter =
    typeof sp.functional === "string" && sp.functional !== ""
      ? sp.functional === "yes"
      : null;

  let inspections: InspectionRow[] = [];
  let inspectorNames = new Map<string, string | null>();
  let dbError: string | null = null;
  try {
    [inspections, inspectorNames] = await Promise.all([
      queryInspections(500),
      fetchInspectorNames(),
    ]);
  } catch (err) {
    dbError = describeError(err);
  }

  let rows = inspections;
  if (conditionFilter) rows = rows.filter((i) => i.condition === conditionFilter);
  if (functionalFilter !== null) {
    rows = rows.filter((i) => i.functional === functionalFilter);
  }
  const needsAttention = rows.filter(
    (i) => !i.functional || ["POOR", "DAMAGED", "NOT_FUNCTIONAL"].includes(i.condition),
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Inspections</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {rows.length} field reports
            {needsAttention > 0 && (
              <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {needsAttention} need attention
              </span>
            )}
          </p>
        </div>
      </div>

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Supabase error:</strong> {dbError}
        </div>
      )}

      {/* Filter bar */}
      <form
        method="GET"
        action="/dashboard/inspections"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div>
          <label
            htmlFor="condition"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >
            Condition
          </label>
          <select
            id="condition"
            name="condition"
            defaultValue={conditionFilter ?? ""}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All conditions</option>
            {Object.entries(CONDITION_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="functional"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >
            Functioning?
          </label>
          <select
            id="functional"
            name="functional"
            defaultValue={functionalFilter === null ? "" : functionalFilter ? "yes" : "no"}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All</option>
            <option value="yes">Functional</option>
            <option value="no">Not functional</option>
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Apply filters
        </button>
        {(conditionFilter || functionalFilter !== null) && (
          <Link
            href="/dashboard/inspections"
            className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
          >
            Clear
          </Link>
        )}
      </form>

            {rows.length === 0 && !dbError ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No inspections found"
          hint="Field reports recorded on mobile will appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Asset</th>
                <th className="px-5 py-3">Condition</th>
                <th className="px-5 py-3">Works?</th>
                <th className="px-5 py-3">Inspected by</th>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Photos</th>
                <th className="px-5 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((i) => (
                <tr key={i.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-zinc-900">{i.assets?.code ?? "—"}</p>
                    <p className="text-xs text-zinc-500">
                      {i.assets?.asset_types?.name ?? ""}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <Badge className={CONDITION_META[i.condition].badge}>
                      {CONDITION_META[i.condition].label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    {i.functional ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Functional</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">Not functional</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {inspectorNames.get(i.inspector_id) ?? "Unknown"}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{fmtDateTime(i.inspected_at)}</td>
                  <td className="px-5 py-3 text-zinc-500">
                    {i.inspection_photos?.length ?? 0} 📷
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/dashboard/inspections/${i.id}`}
                      className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
