import "server-only";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface Viewer {
  user: { id: string; email?: string };
  profile: Profile;
}

/**
 * Returns the signed-in user + profile, or null when there is no session
 * (or Supabase has not been configured yet).
 */
export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!data) return null;
    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: data as Profile,
    };
  } catch {
    return null;
  }
}

/** Guards a page/layout — redirects to /login when there is no viewer. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Guards an admin-only page/layout. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.profile.role !== "ADMIN") redirect("/dashboard");
  return viewer;
}
