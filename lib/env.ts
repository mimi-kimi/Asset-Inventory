/**
 * Public environment configuration.
 * Only NEXT_PUBLIC_* values live here — safe for the browser bundle.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** Storage bucket used for inspection & asset photos. */
export const PHOTO_BUCKET = "inspection-photos";

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
