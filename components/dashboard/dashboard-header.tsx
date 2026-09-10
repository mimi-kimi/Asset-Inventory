"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Cone,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  Smartphone,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import type { Role } from "@/lib/types";

const MANAGE_LINKS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}> = [
  { href: "/dashboard", label: "Map dashboard", icon: LayoutDashboard },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListChecks },
  { href: "/dashboard/assets", label: "Assets", icon: Cone },
  { href: "/dashboard/inspections", label: "Inspections", icon: ClipboardList },
  { href: "/dashboard/types", label: "Asset types", icon: Tags, adminOnly: true },
];

export function DashboardHeader({
  fullName,
  role,
  isAdmin,
}: {
  fullName: string | null;
  role: Role;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const links = MANAGE_LINKS.filter((l) => !l.adminOnly || isAdmin);

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-[1200] border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center justify-between gap-3 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-lg text-zinc-950">🚸</span>
          <span className="hidden font-bold text-zinc-900 sm:inline">Road Asset Tracker</span>
        </Link>

        {/* Desktop nav — these pages used to live in the profile dropdown */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {links.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-amber-50 text-amber-800"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/tasks"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              pathname.startsWith("/dashboard/tasks")
                ? "bg-amber-100 text-amber-800"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400",
            )}
            title="Import and manage tasks"
          >
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Task</span>
          </Link>

          <Link
            href="/mobile"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Smartphone className="h-4 w-4" />
            <span className="hidden sm:inline">Mobile</span>
          </Link>

          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-1.5 py-1.5 transition-colors hover:bg-zinc-50"
          >
            <Avatar name={fullName} />
            <span className="hidden text-left xl:block">
              <span className="block text-xs font-semibold leading-tight text-zinc-800">
                {fullName ?? "User"}
              </span>
              <span className="block text-[10px] leading-tight text-zinc-500">
                {role === "ADMIN" ? "Admin" : "Inspector"}
              </span>
            </span>
            <LogOut className="h-4 w-4 shrink-0 text-zinc-400" />
          </button>
        </div>
      </div>
            <div className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-3 pb-2 pt-1.5 lg:hidden">
        {links.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                active
                  ? "bg-amber-500 text-zinc-950"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/mobile"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200"
        >
          <MonitorSmartphone className="h-3.5 w-3.5" />
          Mobile view
        </Link>
      </div>
    </header>
  );
}