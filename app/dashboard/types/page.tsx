import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { queryAssetTypes } from "@/lib/queries";
import { AssetTypeManager } from "@/components/dashboard/asset-type-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Asset types" };

export default async function AssetTypesPage() {
  await requireAdmin();
  let types: Awaited<ReturnType<typeof queryAssetTypes>> = [];
  let dbError: string | null = null;
  try {
    types = await queryAssetTypes();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Could not load asset types.";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Asset types</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          The catalog used when registering assets and running inspections.
        </p>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dbError}
        </div>
      ) : (
        <AssetTypeManager initial={types} />
      )}
    </div>
  );
}
