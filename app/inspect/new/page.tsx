import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryAssetTypes } from "@/lib/queries";
import { describeError } from "@/lib/format";
import { NewInspectionWizard } from "@/components/inspection/new-inspection-wizard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New inspection" };

export default async function NewInspectionPage() {
  await requireViewer();
  let types: Awaited<ReturnType<typeof queryAssetTypes>> = [];
  let dbError: string | null = null;
  try {
    types = await queryAssetTypes();
  } catch (err) {
    dbError = describeError(err);
  }

  return (
    <div className="space-y-4">
      <Link
        href="/inspect"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" /> My reports
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">New inspection</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Three quick steps. Works great from a phone in the field.
        </p>
      </div>

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Supabase error:</strong> {dbError}
        </div>
      )}

      {!dbError && types.length === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          No asset types exist yet. An admin needs to add them in{" "}
          <Link
            href="/dashboard/types"
            className="font-semibold underline"
          >
            Dashboard → Asset types
          </Link>{" "}
          before inspections can be recorded.
        </div>
      )}

      {!dbError && types.length > 0 && <NewInspectionWizard assetTypes={types} />}
    </div>
  );
}
