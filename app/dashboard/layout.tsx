import type { ReactNode } from "react";
import { requireViewer } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard/shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await requireViewer();
  return (
    <DashboardShell
      fullName={viewer.profile.full_name}
      email={viewer.user.email}
      role={viewer.profile.role}
    >
      {children}
    </DashboardShell>
  );
}
