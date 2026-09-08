"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Cone,
  LayoutDashboard,
  LogOut,
  Smartphone,
  Tags,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Avatar, Badge } from "@/components/ui";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  highlight?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Cone },
  { href: "/dashboard/inspections", label: "Inspections", icon: ClipboardList },
  { href: "/dashboard/types", label: "Asset types", icon: Tags, adminOnly: true },
  { href: "/inspect", label: "Mobile inspection", icon: Smartphone, highlight: true },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RoleBadge({ role }: { role: Role }) {
  return role === "ADMIN" ? (
    <Badge className="bg-amber-500/20 text-amber-400">Admin</Badge>
  ) : (
    <Badge className="bg-sky-500/20 text-sky-400">Inspector</Badge>
  );
}

export function DashboardShell({
  children,
  fullName,
  email,
  role,
}: {
  children: ReactNode;
  fullName: string | null;
  email?: string;
  role: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "ADMIN";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  async function signOut() {
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-zinc-950 text-zinc-300 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-lg text-zinc-950">
            🚸
          </span>
          <span className="text-base font-bold text-white">Road Asset Tracker</span>
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  item.highlight && !active && "text-amber-400/90 hover:bg-amber-500/10",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {fullName ?? "User"}
              </p>
              <p className="truncate text-xs text-zinc-500">{email}</p>
              <div className="mt-1">
                <RoleBadge role={role} />
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-base text-zinc-950">
              🚸
            </span>
            <span className="text-sm font-bold text-zinc-900">Road Asset Tracker</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
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
        </nav>
      </header>

      {/* Content */}
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
