"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Keeps a page in step with what other accounts are recording: re-fetches the
 * server data on an interval (while the tab is visible) and whenever the tab
 * regains focus. Silently a no-op on the routes listed in `skip` (forms that
 * hold unsaved input).
 */
export function AutoRefresh({
  seconds = 20,
  skip = [],
}: {
  seconds?: number;
  skip?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const paused = skip.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (paused) return;

    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(tick, Math.max(5, seconds) * 1000);
    const onWake = () => tick();

    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [router, seconds, paused]);

  return null;
}
