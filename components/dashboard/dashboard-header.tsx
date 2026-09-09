"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
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
import { Avatar, Badge } from "@/components/ui";
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
  email,
  role,
  isAdmin,
}: {
  fullName: string | null;
  email?: string;
  role: Role;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = MANAGE_LINKS.filter((l) => !l.adminOnly || isAdmin);

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1700px] items-center justify-between gap-3 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-lg text-zinc-950">🚸</span>
          <span className="hidden font-bold text-zinc-900 sm:inline">Road Asset Tracker</span>
        </Link>

        <h1 className="pointer-events-none hidden flex-1 truncate text-center text-base font-bold text-zinc-700 lg:block">
          Asset Inventory · Inspection Dashboard
        </h1>

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

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-1.5 py-1.5 hover:bg-zinc-50"
            >
              <Avatar name={fullName} />
              <span className="hidden text-sm font-semibold text-zinc-700 md:inline">{fullName ?? "User"}</span>
              <ChevronDown className="hidden h-4 w-4 text-zinc-400 md:block" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
                  <div className="border-b border-zinc-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-zinc-900">{fullName ?? "User"}</p>
                    <p className="truncate text-xs text-zinc-500">{email}</p>
                    <div className="mt-1.5">
                      {role === "ADMIN" ? (
                        <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
                      ) : (
                        <Badge className="bg-sky-100 text-sky-800">Inspector</Badge>
                      )}
                    </div>
                  </div>
                  <nav className="p-1.5">
                    {links.map((item) => {
                      const Icon = item.icon;
                      const active = item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                            active ? "bg-amber-50 text-amber-800" : "text-zinc-700 hover:bg-zinc-100",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-t border-zinc-100 p-1.5">
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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