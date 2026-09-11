import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { AccountForm } from "@/components/account/account-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const viewer = await requireViewer();

  return (
    <main className="min-h-dvh bg-zinc-100 py-8">
      <div className="mx-auto w-full max-w-lg px-4">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-lg text-zinc-950">
              🚸
            </span>
            <span className="font-bold text-zinc-900">Road Asset Tracker</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-500 hover:text-zinc-800"
          >
            Dashboard
          </Link>
        </div>

        <AccountForm
          fullName={viewer.profile.full_name}
          username={viewer.profile.username ?? null}
          email={viewer.user.email ?? viewer.profile.email ?? null}
          role={viewer.profile.role}
          mustChange={Boolean(viewer.profile.must_change_password)}
        />
      </div>
    </main>
  );
}
