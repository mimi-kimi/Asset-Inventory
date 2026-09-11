import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { describeError } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "@/components/dashboard/users-manager";
import type { UserRow } from "@/components/dashboard/users-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requireAdmin();

  let rows: UserRow[] = [];
  let dbError: string | null = null;
  try {
    const supabase = await createClient();
    const [{ data: profiles, error: pErr }, { data: inspections, error: iErr }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, role, active, email, created_at")
          .order("role")
          .order("username"),
        supabase.from("inspections").select("inspector_id"),
      ]);
    if (pErr) throw pErr;
    if (iErr) throw iErr;

    const counts = new Map<string, number>();
    for (const i of (inspections ?? []) as { inspector_id: string }[]) {
      counts.set(i.inspector_id, (counts.get(i.inspector_id) ?? 0) + 1);
    }

    rows = ((profiles ?? []) as Omit<UserRow, "inspections">[]).map((p) => ({
      ...p,
      inspections: counts.get(p.id) ?? 0,
    }));
  } catch (err) {
    dbError = describeError(err);
  }

  if (dbError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <strong>Supabase error:</strong> {dbError}
      </div>
    );
  }

  return <UsersManager rows={rows} />;
}
