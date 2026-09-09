import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, ClipboardList, Plus } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { queryMyInspections } from "@/lib/queries";
import { CONDITION_META, describeError, fmtDateTime } from "@/lib/format";
import { Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My inspections" };

export default async function InspectHomePage() {
  const viewer = await requireViewer();

  let recent: Awaited<ReturnType<typeof queryMyInspections>> = [];
  let dbError: string | null = null;
  try {
    recent = await queryMyInspections(viewer.user.id, 30);
  } catch (err) {
    dbError = describeError(err);
  }

  return (
    <div className="space-y-5">
      {/* Primary CTA — the whole point of the mobile app */}
      <Link
        href="/inspect/new"
        className="group flex items-center gap-4 rounded-2xl bg-amber-500 p-5 shadow-sm transition-transform active:scale-[0.99]"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-white">
          <Camera className="h-7 w-7" />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold text-zinc-950">
            Start a new inspection
          </span>
          <span className="block text-sm text-zinc-800">
            Tap here, answer 3 quick steps, add a photo — done.
          </span>
        </span>
        <ArrowRight className="h-6 w-6 text-zinc-800" />
      </Link>

      {dbError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Supabase error:</strong> {dbError}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <ClipboardList className="h-4 w-4 text-zinc-400" />
            My recent reports
          </h2>
          <Badge className="bg-zinc-100 text-zinc-600">{recent.length}</Badge>
        </div>

        {recent.length === 0 && !dbError ? (
          <div className="p-4">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8" />}
              title="Nothing here yet"
              hint="Your submitted inspection reports will be listed here."
              action={
                <Link
                  href="/inspect/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  <Plus className="h-4 w-4" /> First inspection
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recent.map((i) => {
              const meta = CONDITION_META[i.condition];
              return (
                <li key={i.id}>
                  <Link
                    href={`/inspect/${i.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50"
                  >
                    <span className="text-xl">{meta.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-900">
                        {i.assets?.code ?? "Unknown asset"}
                        {i.assets?.asset_types?.name
                          ? ` · ${i.assets.asset_types.name}`
                          : ""}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {fmtDateTime(i.inspected_at)}
                      </p>
                    </div>
                    <Badge className={meta.badge}>{meta.label}</Badge>
                    {!i.functional && (
                      <Badge className="bg-red-100 text-red-700">Out</Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
