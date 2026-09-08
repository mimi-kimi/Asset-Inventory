import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Cone,
  Plus,
  Smartphone,
} from "lucide-react";
import { requireViewer } from "@/lib/auth";
import {
  countInspectors,
  queryAssets,
  queryInspections,
} from "@/lib/queries";
import { Badge, Card, CardHeader, EmptyState, StatCard } from "@/components/ui";
import { CONDITION_META, fmtDateTime } from "@/lib/format";
import { AssetMap } from "@/components/map/asset-map";
import { AssetsByTypeChart } from "@/components/charts/assets-by-type";
import { ConditionChart } from "@/components/charts/condition-chart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard overview" };

const BAD_CONDITIONS = new Set(["POOR", "DAMAGED", "NOT_FUNCTIONAL"]);

export default async function DashboardOverviewPage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";

  let assets: Awaited<ReturnType<typeof queryAssets>> = [];
  let inspections: Awaited<ReturnType<typeof queryInspections>> = [];
  let inspectorCount = 0;
  let dbError: string | null = null;

  try {
    [assets, inspections, inspectorCount] = await Promise.all([
      queryAssets(),
      queryInspections(8),
      countInspectors(),
    ]);
  } catch (err) {
    dbError =
      err instanceof Error ? err.message : "Could not load dashboard data.";
  }

  const typeNames = new Map<string, string>();
  for (const a of assets) {
    if (a.asset_types?.name) typeNames.set(a.type_id, a.asset_types.name);
  }
  const byType = new Map<string, number>();
  for (const a of assets) {
    const name = typeNames.get(a.type_id) ?? "Uncategorised";
    byType.set(name, (byType.get(name) ?? 0) + 1);
  }
  const typeChart = [...byType.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const condCount = new Map<string, number>();
  let attention = 0;
  for (const i of inspections) {
    condCount.set(i.condition, (condCount.get(i.condition) ?? 0) + 1);
    if (!i.functional || BAD_CONDITIONS.has(i.condition)) attention += 1;
  }
  const conditionChart = [...condCount.entries()].map(([condition, count]) => ({
    condition: condition as keyof typeof CONDITION_META,
    count,
  }));

  const mapPoints = assets
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => ({
      code: a.code,
      label: typeNames.get(a.type_id) ?? "Asset",
      lat: a.lat as number,
      lng: a.lng as number,
    }));

  const activeAssets = assets.filter((a) => a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Overview</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Welcome back, {viewer.profile.full_name ?? "there"}.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href="/dashboard/assets/new"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" /> New asset
            </Link>
          )}
          <Link
            href="/inspect/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Smartphone className="h-4 w-4" /> Start inspection
          </Link>
        </div>
      </div>

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Supabase error:</strong> {dbError} — did you run{" "}
          <code className="rounded bg-red-100 px-1">supabase/schema.sql</code>{" "}
          yet?
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total assets" value={assets.length} icon={<Cone className="h-5 w-5" />} />
        <StatCard label="Active assets" value={activeAssets} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Inspections" value={inspections.length} sub="recently recorded" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Field staff" value={inspectorCount} sub="registered inspectors" icon={<Smartphone className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assets by type" subtitle="Inventory breakdown" />
          <div className="px-4 py-3">
            <AssetsByTypeChart data={typeChart} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Condition of latest inspections"
            subtitle={
              attention > 0 ? `${attention} need attention` : "No issues flagged recently"
            }
          />
          <div className="px-4 py-3">
            <ConditionChart data={conditionChart} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Asset map"
          subtitle="Assets with recorded GPS positions"
          action={
            <Link
              href="/dashboard/assets"
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-600"
            >
              Manage assets <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="p-4">
          <AssetMap points={mapPoints} />
        </div>
      </Card>

            <Card>
        <CardHeader
          title="Recent inspections"
          subtitle="Latest field reports across your network"
          action={
            <Link
              href="/dashboard/inspections"
              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-600"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {inspections.length === 0 && !dbError ? (
          <div className="p-4">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="No inspections recorded yet"
              hint="Use the mobile inspection flow to log the first field report."
              action={
                <Link
                  href="/inspect/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  <Smartphone className="h-4 w-4" /> Open inspection
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {inspections.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/dashboard/inspections/${i.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${CONDITION_META[i.condition].dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {i.assets?.code ?? "Unknown asset"}
                      {i.assets?.asset_types?.name ? ` · ${i.assets.asset_types.name}` : ""}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {i.assets?.location ?? "No location"} · {i.profiles?.full_name ?? "—"}
                    </p>
                  </div>
                  <Badge className={CONDITION_META[i.condition].badge}>
                    {CONDITION_META[i.condition].label}
                  </Badge>
                  <span className="hidden text-xs text-zinc-400 sm:block">
                    {fmtDateTime(i.inspected_at)}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
