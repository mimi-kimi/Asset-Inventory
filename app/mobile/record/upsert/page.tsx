import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { describeError } from "@/lib/format";
import {
  queryAssetTypes,
  queryAssetWithInspectionsById,
  queryInspectionById,
} from "@/lib/queries";
import { RecordForm } from "@/components/mobile/record-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Record" };

export default async function UpsertPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; inspection?: string }>;
}) {
  await requireViewer();
  const sp = await searchParams;
  const assetId = typeof sp.asset === "string" ? sp.asset : "";
  const inspectionId = typeof sp.inspection === "string" ? sp.inspection : "";

  let asset: Awaited<ReturnType<typeof queryAssetWithInspectionsById>> = null;
  let inspection: Awaited<ReturnType<typeof queryInspectionById>> = null;
  let assetTypes: Awaited<ReturnType<typeof queryAssetTypes>> = [];
  let dbError: string | null = null;

  try {
    assetTypes = await queryAssetTypes();

    if (inspectionId) {
      inspection = await queryInspectionById(inspectionId);
      if (inspection?.assets?.id) {
        asset = await queryAssetWithInspectionsById(inspection.assets.id);
      }
    } else if (assetId) {
      asset = await queryAssetWithInspectionsById(assetId);
    }

    if ((assetId && !asset) || (inspectionId && !inspection)) notFound();
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
      assetTypes={assetTypes}
    />
  );
}
