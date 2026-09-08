"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/format";
import { btnGhost } from "@/components/ui";

export function SignOutButton({
  className,
  compact = true,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } finally {
      setBusy(false);
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className={cn(btnGhost, className)}
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
      {!compact && "Sign out"}
    </button>
  );
}
