import type { ReactNode } from "react";
import Link from "next/link";
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
        </div>
        <div className="pb-24">{children}</div>
        <MobileNav />
      </div>
    </div>
  );
}
