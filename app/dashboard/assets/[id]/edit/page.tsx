import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { queryAssetById, queryAssetTypes } from "@/lib/queries";
import { AssetForm } from "@/components/dashboard/asset-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [asset, types] = await Promise.all([queryAssetById(id), queryAssetTypes()]);

  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to assets
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          Edit {asset.code}
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Update details about this asset.
        </p>
      </div>

      <AssetForm assetTypes={types} asset={asset} />
    </div>
  );
}
