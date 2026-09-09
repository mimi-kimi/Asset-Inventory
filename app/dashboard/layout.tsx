import type { ReactNode } from "react";
import { requireViewer } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";
  return (
    <div className="min-h-dvh bg-zinc-100">
      <DashboardHeader
        fullName={viewer.profile.full_name}
        email={viewer.user.email}
        role={viewer.profile.role}
        isAdmin={isAdmin}
      />
      <main className="mx-auto w-full max-w-[1700px] px-4 py-5">
        {children}
      </main>
    </div>
  );
}

