import type { Metadata } from "next";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { Avatar, Badge, Card } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

export default async function MobileProfilePage() {
  const viewer = await requireViewer();
  const isAdmin = viewer.profile.role === "ADMIN";

  return (
    <div className="space-y-4 px-4 pt-4">
      <h1 className="text-xl font-bold text-zinc-900">Profile</h1>

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={viewer.profile.full_name} className="h-14 w-14 text-lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-zinc-900">
              {viewer.profile.full_name ?? "User"}
            </p>
            <p className="truncate text-sm text-zinc-500">
              {viewer.profile.username
                ? `@${viewer.profile.username}`
                : viewer.user.email}
            </p>
            <div className="mt-1">
              {isAdmin ? (
                <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
              ) : (
                <Badge className="bg-sky-100 text-sky-800">Inspector</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-zinc-100">
        <Link
          href="/account"
          className="flex items-center gap-3 px-5 py-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <MonitorSmartphone className="h-5 w-5 text-zinc-400" />
          Edit profile &amp; password
        </Link>
        {isAdmin && (
          <Link
            href="/dashboard/users"
            className="flex items-center gap-3 px-5 py-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <MonitorSmartphone className="h-5 w-5 text-zinc-400" />
            Manage users
          </Link>
        )}
        <Link
          href="/dashboard"
          className="hidden items-center gap-3 px-5 py-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 lg:flex"
        >
          <MonitorSmartphone className="h-5 w-5 text-zinc-400" />
          Open desktop dashboard
        </Link>
        <div className="flex items-center justify-between px-5 py-3">
          <SignOutButton compact={false} />
        </div>
      </Card>

      <p className="text-center text-xs text-zinc-400">
        Road Asset Tracker v2 · Powered by Next.js + Supabase
      </p>
    </div>
  );
}
