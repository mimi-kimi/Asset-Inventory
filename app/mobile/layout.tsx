import type { ReactNode } from "react";
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
        <div className="pb-24">{children}</div>
        <MobileNav />
      </div>
    </div>
  );
}
