import type { ReactNode } from "react";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { MobileNav } from "@/components/mobile/mobile-nav";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireViewer();

  return (
    <div className="min-h-dvh bg-zinc-200">
      <div className="relative mx-auto min-h-dvh w-full max-w-lg bg-zinc-100 shadow-2xl">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5">
          <Link href="/mobile" className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-sm text-zinc-950">
              🚸
            </span>
            <span className="truncate text-sm font-bold text-zinc-900">
              Road Asset Tracker
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 lg:inline-flex"
          >
            <MonitorSmartphone className="h-3.5 w-3.5" />
            Desktop view
          </Link>
        </div>
        <div className="pb-24">{children}</div>
        <MobileNav />
      </div>
    </div>
  );
}
