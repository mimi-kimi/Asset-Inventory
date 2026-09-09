"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Map as MapIcon, User, ListChecks } from "lucide-react";
import { cn } from "@/lib/format";

const ITEMS = [
  { href: "/mobile", label: "Map", icon: MapIcon },
  { href: "/mobile/task", label: "Task", icon: ListChecks },
  { href: "/mobile/record", label: "Record", icon: ClipboardList },
  { href: "/mobile/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  // hide the nav inside the recording flow for a focused full-screen form
  if (pathname.startsWith("/mobile/record/upsert")) return null;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/mobile"
              ? pathname === "/mobile"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                active
                  ? "text-amber-600"
                  : "text-zinc-400 hover:text-zinc-600",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
