import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export function isServiceRoleConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * Service-role client — bypasses RLS. Server-only, never import this into a
 * client component. Every caller must verify the requester is an ADMIN.
 */
export function createAdminClient() {
  if (!isServiceRoleConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Add it in Vercel → Settings → Environment Variables.",
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
