import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/env";

/** Folder-safe folder name for a username ("Sitechecker 1" → "sitechecker-1"). */
export function safeFolder(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "unknown";
}

/** Folder-safe file segment for the marker number / code. */
function safeSegment(value: string | number | null | undefined): string {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "x";
}

/**
 * Object path of an inspection photo: `<username>/<marker seq>_<epoch ms>.webp`
 * e.g. `sitechecker1/3_1783477395101.webp`, which is served as
 * `<SUPABASE_URL>/storage/v1/object/public/tree-photos/sitechecker1/3_1783477395101.webp`
 */
export function photoObjectPath({
  username,
  assetSeq,
  at = Date.now(),
}: {
  username?: string | null;
  assetSeq?: string | number | null;
  at?: number;
}): string {
  return `${safeFolder(username)}/${safeSegment(assetSeq)}_${at}.webp`;
}

export interface UploadedPhoto {
  /** object path inside the bucket (kept so the file can be replaced/removed) */
  path: string;
  /** the public URL to store on the inspection */
  url: string;
}

/** Uploads a (already downscaled) WebP and returns its path + public URL. */
export async function uploadInspectionPhoto(
  supabase: SupabaseClient,
  {
    blob,
    username,
    assetSeq,
  }: {
    blob: Blob;
    username?: string | null;
    assetSeq?: string | number | null;
  },
): Promise<UploadedPhoto> {
  const path = photoObjectPath({ username, assetSeq });
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

/** Best-effort removal of a replaced/removed photo (ignores failures). */
export async function deleteInspectionPhoto(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  } catch {
    /* the row is what matters; a leftover object is harmless */
  }
}