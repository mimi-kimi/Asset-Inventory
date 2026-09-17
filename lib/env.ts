/**
 * Public environment configuration.
 * Only NEXT_PUBLIC_* values live here — safe for the browser bundle.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * Storage bucket used for inspection & asset photos (public bucket).
 * Defaults to `tree-photos`; override with NEXT_PUBLIC_PHOTO_BUCKET.
 */
export const PHOTO_BUCKET =
  process.env.NEXT_PUBLIC_PHOTO_BUCKET?.trim() || "tree-photos";

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
