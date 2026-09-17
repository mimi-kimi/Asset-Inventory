import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { queryCatalog } from "@/lib/queries";
import { CatalogManager } from "@/components/dashboard/catalog-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Asset catalog" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string | string[] }>;
}) {
  await requireAdmin();

  const { asset } = await searchParams;
  const initialAssetId = Array.isArray(asset) ? asset[0] ?? "" : asset ?? "";

  let dbError: string | null = null;
  let catalog: Awaited<ReturnType<typeof queryCatalog>> = {
    assets: [],
    levels: [],
    options: [],
  };
  try {
    catalog = await queryCatalog();
  } catch (err) {
    dbError = describeError(err);
  }

  if (dbError) {
    return (
      <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <p>
          <strong>Supabase error:</strong> {dbError}
        </p>
        <p className="text-red-700/80">
          Did you run <code className="rounded bg-red-100 px-1">supabase/migration_v5.sql</code>{" "}
          in the Supabase SQL editor? It creates{" "}
          <code className="rounded bg-red-100 px-1">catalog_assets</code>,{" "}
          <code className="rounded bg-red-100 px-1">catalog_levels</code>,{" "}
          <code className="rounded bg-red-100 px-1">catalog_options</code> and the L1–L6
          columns on <code className="rounded bg-red-100 px-1">inspections</code>.
        </p>
      </div>
    );
  }

  return <CatalogManager catalog={catalog} initialAssetId={initialAssetId} />;
}
