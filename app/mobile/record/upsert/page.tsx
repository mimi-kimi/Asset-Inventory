import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { canEditInspection } from "@/lib/roles";
import { queryAssetWithInspectionsById, queryInspectionById, fetchInspectorNames } from "@/lib/queries";
import { RecordForm } from "@/components/mobile/record-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Record" };

export default async function UpsertPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; inspection?: string }>;
}) {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";
  const sp = await searchParams;
  const assetId = typeof sp.asset === "string" ? sp.asset : "";
  const inspectionId = typeof sp.inspection === "string" ? sp.inspection : "";

  let asset: Awaited<ReturnType<typeof queryAssetWithInspectionsById>> = null;
  let inspection: Awaited<ReturnType<typeof queryInspectionById>> = null;
  /** a report this form pre-fills from — the marker's latest one */
  let previous: Awaited<ReturnType<typeof queryInspectionById>> = null;
  /** set when that report was written by somebody else */
  let previousBy: string | null = null;
  /** false when the seeded report belongs to another user (cannot be updated) */
  let canEditSeed = true;
  let dbError: string | null = null;

  try {
    const names = await fetchInspectorNames();
    const authorOf = (row: { inspector_id: string } | null) =>
      row ? (names.get(row.inspector_id) ?? null) : null;

    if (inspectionId) {
      const found = await queryInspectionById(inspectionId);
      if (found?.assets?.id) {
        asset = await queryAssetWithInspectionsById(found.assets.id);
      }
      /* everyone can read every report, but only its author (or an admin) may
         change it — otherwise it just seeds a new report of our own */
      if (found && canEditInspection({ inspectorId: found.inspector_id, meId: viewer.user.id, isAdmin })) {
        inspection = found;
        if (found.inspector_id !== viewer.user.id) previousBy = authorOf(found);
      } else if (found) {
        previous = found;
        previousBy = authorOf(found);
        canEditSeed = false;
      }
    } else if (assetId) {
      asset = await queryAssetWithInspectionsById(assetId);
      const latest = asset?.inspections?.length
        ? [...asset.inspections].sort((a, b) =>
            b.inspected_at.localeCompare(a.inspected_at),
          )[0]
        : null;
      if (latest?.id) {
        previous = await queryInspectionById(latest.id);
        if (previous && previous.inspector_id !== viewer.user.id) {
          previousBy = authorOf(previous);
          canEditSeed = isAdmin;
        }
      }
    }

    if ((assetId && !asset) || (inspectionId && !asset && !previous)) notFound();
  } catch (err) {
    dbError = describeError(err);
  }

  if (dbError) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <strong>Supabase error:</strong> {dbError}
      </div>
    );
  }

  return (
    <RecordForm
      asset={asset}
      inspection={inspection}
      previous={previous}
      previousBy={previousBy}
      canEditSeed={canEditSeed}
      username={viewer.profile.username}
    />
  );
}
