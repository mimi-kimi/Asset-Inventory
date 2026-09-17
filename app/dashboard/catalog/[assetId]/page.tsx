import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { queryCatalogAsset } from "@/lib/queries";
import { buildTree } from "@/lib/catalog-tree";
import { AssetCatalogEditor } from "@/components/dashboard/catalog-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalog asset" };

export default async function CatalogAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  await requireAdmin();
  const { assetId } = await params;

  let dbError: string | null = null;
  let data: Awaited<ReturnType<typeof queryCatalogAsset>> = {
    assets: [],
    levels: [],
    options: [],
  };
  try {
    data = await queryCatalogAsset(assetId);
  } catch (err) {
    dbError = describeError(err);
  }
  if (dbError) notFound();

  const asset = buildTree(data).assets[0];
  if (!asset) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/dashboard/catalog?asset=${asset.id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to catalog
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{asset.name}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
          Rename the asset, add or remove its levels (L2…L6) and edit every value with
          its price. Values are typed one per line; the price is optional and any level
          below inherits it.
        </p>
      </div>

      <AssetCatalogEditor asset={asset} mode="full" />
    </div>
  );
}