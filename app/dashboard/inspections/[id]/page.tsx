import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryInspectionById, fetchInspectorNames } from "@/lib/queries";
import { CONDITION_META, describeError, fmtCoords, fmtDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui";
import { PhotoGrid } from "@/components/photo-grid";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inspection detail" };

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireViewer();
  const { id } = await params;

  let inspection: Awaited<ReturnType<typeof queryInspectionById>> = null;
  let inspectorName: string | null = null;
  let dbError: string | null = null;
  try {
    inspection = await queryInspectionById(id);
    if (inspection) {
      const names = await fetchInspectorNames();
      inspectorName = names.get(inspection.inspector_id) ?? null;
    }
  } catch (err) {
    dbError = describeError(err);
  }
  if (dbError || !inspection) notFound();

  const meta = CONDITION_META[inspection.condition];
  const asset = inspection.assets;
  const photos = inspection.inspection_photos ?? [];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/inspections"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to inspections
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          {asset?.code ?? "Inspection"} report
        </h1>
        <p className="text-sm text-zinc-500">
          {asset?.asset_types?.icon ?? ""} {asset?.asset_types?.name ?? "Asset"}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Findings" />
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${meta.badge}`}>
                <span className="text-2xl">{meta.emoji}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Condition
                  </p>
                  <p className="text-lg font-bold leading-tight">{meta.label}</p>
                </div>
              </div>
              {inspection.functional ? (
                <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" /> Functional
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">
                  <XCircle className="h-5 w-5" /> Not functional
                </span>
              )}
            </div>
            <div className="border-t border-zinc-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Remarks
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                {inspection.remarks || "No remarks recorded."}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Photos"
              subtitle={`${photos.length} photo${photos.length === 1 ? "" : "s"} attached`}
            />
            <div className="p-4">
              <PhotoGrid urls={photos.map((p) => p.photo_url)} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Asset" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Code
                </dt>
                <dd className="font-semibold text-zinc-900">{asset?.code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Type
                </dt>
                <dd>{asset?.asset_types?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Location
                </dt>
                <dd className="flex items-start gap-1.5 text-zinc-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  {asset?.location ?? "No location recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Coordinates
                </dt>
                <dd>{fmtCoords(asset?.lat, asset?.lng)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Report details" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Inspector
                </dt>
                <dd>{inspectorName ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Inspected at
                </dt>
                <dd>{fmtDateTime(inspection.inspected_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Recorded
                </dt>
                <dd>{fmtDateTime(inspection.created_at ?? inspection.inspected_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
