import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { queryAssetTypes } from "@/lib/queries";
import { describeError } from "@/lib/format";
import { AssetForm } from "@/components/dashboard/asset-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New asset" };

export default async function NewAssetPage() {
  await requireAdmin();
  let types: Awaited<ReturnType<typeof queryAssetTypes>> = [];
  let dbError: string | null = null;
  try {
    types = await queryAssetTypes();
  } catch (err) {
    dbError = describeError(err);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to assets
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">New asset</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Register a traffic signboard, traffic light, road lamp or any road asset.
        </p>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dbError}
        </div>
      ) : (
        <AssetForm assetTypes={types} />
      )}
    </div>
  );
}
