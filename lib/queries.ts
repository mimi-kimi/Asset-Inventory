import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AssetRow, AssetType, InspectionRow } from "@/lib/types";

/**
 * Server-side data helpers. These use the signed-in user's session cookie,
 * so Supabase Row Level Security applies exactly like it does on the client.
 */

export async function queryAssets(): Promise<AssetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*, asset_types(id, code, name, icon)")
    .order("code");
  if (error) throw error;
  return (data ?? []) as AssetRow[];
}

export async function queryAssetTypes(): Promise<AssetType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_types")
    .select("id, code, name, icon, created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as AssetType[];
}

export async function queryInspections(
  limit = 100,
): Promise<InspectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, assets(id, code, location, lat, lng, asset_types(id, code, name, icon)), inspection_photos(id, inspection_id, photo_url)",
    )
    .order("inspected_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

export async function queryInspectionById(
  id: string,
): Promise<InspectionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, assets(id, code, location, lat, lng, asset_types(id, code, name, icon)), inspection_photos(id, inspection_id, photo_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as InspectionRow | null) ?? null;
}

export async function queryMyInspections(
  inspectorId: string,
  limit = 50,
): Promise<InspectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, assets(id, code, location, lat, lng, asset_types(id, code, name, icon)), inspection_photos(id, inspection_id, photo_url)",
    )
    .eq("inspector_id", inspectorId)
    .order("inspected_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InspectionRow[];
}

export async function queryAssetById(id: string): Promise<AssetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*, asset_types(id, code, name, icon)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as AssetRow | null) ?? null;
}

export async function countInspectors(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "INSPECTOR");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Display names for users. Loaded separately instead of an embedded join
 * because PostgREST cannot relate inspections → profiles (they are only
 * linked through the internal auth.users schema). RLS applies: admins see
 * everyone, inspectors see their own row.
 */
export async function fetchInspectorNames(): Promise<
  Map<string, string | null>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");
  if (error) throw error;
  const map = new Map<string, string | null>();
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    map.set(p.id, p.full_name);
  }
  return map;
}
