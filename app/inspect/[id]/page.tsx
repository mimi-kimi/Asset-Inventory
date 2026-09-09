import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryInspectionById, fetchInspectorNames } from "@/lib/queries";
import { CONDITION_META, fmtCoords, fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui";
import { PhotoGrid } from "@/components/photo-grid";
export const metadata: Metadata = { title: "Inspection report" };

export default async function InspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireViewer();
  const { id } = await params;

  let inspection: Awaited<ReturnType<typeof queryInspectionById>> = null;
  let inspectorName: string | null = null;
  try {
    inspection = await queryInspectionById(id);
    if (inspection) {
      const names = await fetchInspectorNames();
      inspectorName = names.get(inspection.inspector_id) ?? null;
    }
  } catch {
    inspection = null;
  }
  // RLS only lets admins or the report's author read it.
  if (!inspection) notFound();

  const meta = CONDITION_META[inspection.condition];
  const photos = inspection.inspection_photos ?? [];

  return (
    <div className="space-y-4">
      <Link
        href="/inspect"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" /> My reports
      </Link>

      {/* Result header */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Inspection report
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-zinc-900">
              {inspection.assets?.code ?? "Unknown asset"}
            </h1>
            <p className="text-sm text-zinc-500">
              {inspection.assets?.asset_types?.name ?? "Road asset"}
            </p>
          </div>
          <span className="text-4xl">{meta.emoji}</span>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-zinc-200 bg-zinc-200">
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Condition
            </p>
            <p className={`mt-0.5 font-bold ${meta.badge.split(" ")[1] ?? "text-zinc-900"}`}>
              {meta.label}
            </p>
          </div>
          <div className="bg-white px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Working?
            </p>
            <p
              className={`mt-0.5 font-bold ${
                inspection.functional ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {inspection.functional ? "Yes — functional" : "No — not functional"}
            </p>
          </div>
        </div>
      </Card>

      {photos.length > 0 && (
        <Card className="p-4">
          <PhotoGrid urls={photos.map((p) => p.photo_url)} />
        </Card>
      )}

      <Card>
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Remarks
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
            {inspection.remarks || "No remarks recorded."}
          </p>
        </div>
        <div className="flex items-start gap-2 border-t border-zinc-100 px-5 py-3 text-sm text-zinc-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <div>
            <p>{inspection.assets?.location ?? "No location recorded"}</p>
            <p className="text-xs text-zinc-400">
              {fmtCoords(inspection.assets?.lat, inspection.assets?.lng)}
            </p>
          </div>
        </div>
      </Card>

      <p className="text-center text-xs text-zinc-400">
        Reported {fmtDateTime(inspection.inspected_at)} by{" "}
        {inspectorName ?? "you"}
      </p>
    </div>
  );
}
