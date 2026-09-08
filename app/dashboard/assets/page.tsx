import type { Metadata } from "next";
import Link from "next/link";
import { Cone, MapPin, Pencil, Plus, Search, X } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryAssetTypes, queryAssets } from "@/lib/queries";
import { fmtCoords, fmtDate } from "@/lib/format";
import type { AssetRow, AssetStatus } from "@/lib/types";
import { Badge, EmptyState } from "@/components/ui";
import { ExportAssetsCsv } from "@/components/dashboard/export-assets-csv";
import { DeleteAssetButton } from "@/components/dashboard/delete-asset-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Assets" };

function StatusBadge({ status }: { status: AssetStatus }) {
  return status === "ACTIVE" ? (
    <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
  ) : (
    <Badge className="bg-zinc-200 text-zinc-600">Inactive</Badge>
  );
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const typeFilter = typeof sp.type === "string" ? sp.type : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";

  let assets: AssetRow[] = [];
  let types: Awaited<ReturnType<typeof queryAssetTypes>> = [];
  let dbError: string | null = null;
  try {
    [assets, types] = await Promise.all([queryAssets(), queryAssetTypes()]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Could not load assets.";
  }

  let rows = assets;
  if (q) {
    rows = rows.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q) ||
        (a.asset_types?.name ?? "").toLowerCase().includes(q),
    );
  }
  if (typeFilter) rows = rows.filter((a) => a.type_id === typeFilter);
  if (statusFilter) rows = rows.filter((a) => a.status === statusFilter);

  const csvRows = rows.map((a) => ({
    code: a.code,
    type: a.asset_types?.name ?? "Uncategorised",
    location: a.location,
    status: a.status,
    lat: a.lat,
    lng: a.lng,
    installed_date: a.installed_date,
  }));

  const hasFilter = Boolean(q || typeFilter || statusFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Assets</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {rows.length} of {assets.length} road assets shown
          </p>
        </div>
        <div className="flex gap-2">
          <ExportAssetsCsv rows={csvRows} filename="road-assets.csv" />
          {isAdmin && (
            <Link
              href="/dashboard/assets/new"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" /> New asset
            </Link>
          )}
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
        action="/dashboard/assets"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="min-w-52 flex-1">
          <label
            htmlFor="q"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              id="q"
              name="q"
              defaultValue={q}
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
              placeholder="Code, location or type…"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="type"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={typeFilter}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="status"
            className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={statusFilter}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          <Search className="h-4 w-4" /> Apply
        </button>
        {hasFilter && (
          <Link
            href="/dashboard/assets"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" /> Clear
          </Link>
        )}
      </form>

            {rows.length === 0 && !dbError ? (
        <EmptyState
          icon={<Cone className="h-8 w-8" />}
          title="No assets found"
          hint={
            hasFilter
              ? "Try adjusting your filters."
              : "Register the first road asset to get started."
          }
          action={
            isAdmin ? (
              <Link
                href="/dashboard/assets/new"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" /> New asset
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Asset</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="hidden px-5 py-3 xl:table-cell">Coordinates</th>
                <th className="hidden px-5 py-3 xl:table-cell">Installed</th>
                {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-zinc-900">{a.code}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {a.notes ?? "No notes"}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{a.asset_types?.icon ?? "🏷️"}</span>
                      {a.asset_types?.name ?? "Uncategorised"}
                    </span>
                  </td>
                  <td className="max-w-56 px-5 py-3">
                    <span className="line-clamp-1 text-zinc-600">
                      {a.location ?? (
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <MapPin className="h-3 w-3" /> No location
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="hidden px-5 py-3 text-zinc-500 xl:table-cell">
                    {fmtCoords(a.lat, a.lng)}
                  </td>
                  <td className="hidden px-5 py-3 text-zinc-500 xl:table-cell">
                    {fmtDate(a.installed_date)}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/assets/${a.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                          title="Edit asset"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <DeleteAssetButton id={a.id} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
