import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { describeError, fmtDateTime } from "@/lib/format";
import { queryMyInspections } from "@/lib/queries";
import { EmptyState, Badge } from "@/components/ui";
import { CONDITION_META } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Records" };

export default async function MobileRecordPage() {
  const viewer = await requireViewer();

  let dbError: string | null = null;
  let records: Awaited<ReturnType<typeof queryMyInspections>> = [];
  try {
    records = await queryMyInspections(viewer.user.id, 40);
  } catch (err) {
    dbError = describeError(err);
  }

  return (
    <div className="space-y-3 px-4 pt-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Records</h1>
          <p className="text-sm text-zinc-500">Your latest inspection reports.</p>
        </div>
        <Link
          href="/mobile"
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950"
        >
          Map
        </Link>
      </div>

      <p className="rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white">
        🚸 New inspection? Open the <span className="font-bold">Map</span> tab,
        tap a marker, then press <span className="font-bold">Inspect</span>.
      </p>

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Supabase error:</strong> {dbError}
        </div>
      )}

      {records.length === 0 && !dbError ? (
        <EmptyState
          title="Nothing recorded yet"
          hint="Once you inspect markers, your reports will be listed here."
        />
      ) : (
        <ul className="space-y-2">
          {records.map((i) => {
            const meta = CONDITION_META[i.condition];
            return (
              <li key={i.id}>
                <Link
                  href={`/mobile/record/upsert?inspection=${i.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:bg-zinc-50"
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-zinc-900">
                      {i.assets?.code ?? "Asset"}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
                      <MapPin className="h-3 w-3" />
                      {i.assets?.location ?? i.assets?.code}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {fmtDateTime(i.inspected_at)}
                    </p>
                  </div>
                  {i.functional ? (
                    <Badge className="bg-emerald-100 text-emerald-800">OK</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700">Out</Badge>
                  )}
                  <ArrowRight className="h-4 w-4 text-zinc-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
