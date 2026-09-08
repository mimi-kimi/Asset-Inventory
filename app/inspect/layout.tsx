import type { ReactNode } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function InspectLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();

  return (
    <div className="min-h-dvh bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/inspect" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-lg text-zinc-950">
              🚸
            </span>
            <div>
              <p className="text-sm font-bold leading-tight text-zinc-900">
                Road Asset Tracker
              </p>
              <p className="text-xs text-zinc-500">Field inspection</p>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100"
              title="Open desktop dashboard"
            >
              <MonitorSmartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6 pb-16">
        <div className="mb-6 flex items-center gap-3">
          <Avatar name={viewer.profile.full_name} className="h-10 w-10 text-sm" />
          <div>
            <p className="text-sm text-zinc-500">Signed in as</p>
            <p className="font-bold text-zinc-900">
              {viewer.profile.full_name ?? "Inspector"}
            </p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
