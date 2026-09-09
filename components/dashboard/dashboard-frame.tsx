"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The map dashboard fills the whole viewport under the header.
 * Management pages keep a padded, readable container.
 */
export function DashboardFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMap = pathname === "/dashboard";

  return (
    <main
      className={
        isMap
          ? "h-[calc(100dvh-4rem)] w-full overflow-y-auto xl:h-[calc(100dvh-4rem)] xl:overflow-hidden"
          : "mx-auto w-full max-w-[1500px] px-4 py-6"
      }
    >
      {children}
    </main>
  );
}
