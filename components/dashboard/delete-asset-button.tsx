"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnGhost } from "@/components/ui";

export function DeleteAssetButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Delete this asset and all its inspection history?")) {
      return;
    }
    setBusy(true);
    try {
      const { error } = await createClient().from("assets").delete().eq("id", id);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Delete failed. It may be in use.",
      );
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className={`${btnGhost} text-red-600 hover:bg-red-50`}
      title="Delete asset"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
