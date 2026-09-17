import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AssetRow,
  CatalogAssetRow,
  CatalogData,
  CatalogLevelRow,
  CatalogOptionRow,
  InspectionRow,
  TaskRow,
} from "@/lib/types";

/**
 * Server-side data helpers. These use the signed-in user's session cookie,
 * so Supabase Row Level Security applies exactly like it does on the client.
 *
 * Note: list queries never select `photo_webp` — base64 photos would make the
 * payload huge. Only the single-inspection query loads them.
 */
const INSPECTION_LIST_COLUMNS =
  "id, asset_id, inspector_id, inspected_at, condition, functional, remarks, created_at, photo_url, catalog_asset_id, asset_category, catalog_path, l2, l3, l4, l5, l6, price, price_manual, other_description, assets(id, code, seq_no, inventory_id, location, type_text, lat, lng), inspection_photos(id, inspection_id, photo_url)";

export async function queryInspections(
  limit = 100,
): Promise<InspectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(INSPECTION_LIST_COLUMNS)
    .order("inspected_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as InspectionRow[];
}

export async function queryInspectionById(
  id: string,
): Promise<InspectionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      "*, assets(id, code, location, type_text, lat, lng), inspection_photos(id, inspection_id, photo_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as InspectionRow | null) ?? null;
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

/** Imported CSV/Excel work batches, newest first. */
export async function queryTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, name, imported_by, row_count, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

/**
 * All task/import assets with their inspection history embedded.
 * Marker colors are derived in code from inspections.
 */
export async function queryTaskAssets(): Promise<AssetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "*, tasks(id, name), inspections(id, inspected_at, condition, functional, remarks, inspector_id, created_at, photo_url, price, price_manual, catalog_asset_id, asset_category, catalog_path, l2, l3, l4, l5, l6, other_description)",
    )
    .not("task_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20000);
  if (error) throw error;
  return (data ?? []) as AssetRow[];
}

export async function queryTaskById(id: string): Promise<TaskRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, name, imported_by, row_count, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as TaskRow | null) ?? null;
}

export async function queryAssetWithInspectionsById(
  id: string,
): Promise<AssetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*, inspections(id, functional, inspected_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as AssetRow | null) ?? null;
}

/** The whole catalog (assets → levels → options) with their prices. */
export async function queryCatalog(): Promise<CatalogData> {
  const supabase = await createClient();
  const [assets, levels, options] = await Promise.all([
    supabase
      .from("catalog_assets")
      .select("id, name, sort_order, price_label, created_at")
      .order("sort_order"),
    supabase.from("catalog_levels").select("id, asset_id, level_no, label"),
    supabase
      .from("catalog_options")
      .select("id, asset_id, level_no, parent_id, value, price, raw_price, sort_order"),
  ]);
  if (assets.error) throw assets.error;
  if (levels.error) throw levels.error;
  if (options.error) throw options.error;
  return {
    assets: (assets.data ?? []) as CatalogAssetRow[],
    levels: (levels.data ?? []) as CatalogLevelRow[],
    options: (options.data ?? []) as CatalogOptionRow[],
  };
}

/** One asset's branch of the catalog (used by the asset editor page). */
export async function queryCatalogAsset(id: string): Promise<CatalogData> {
  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("catalog_assets")
    .select("id, name, sort_order, price_label, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!asset) return { assets: [], levels: [], options: [] };

  const [levels, options] = await Promise.all([
    supabase.from("catalog_levels").select("id, asset_id, level_no, label").eq("asset_id", id),
    supabase
      .from("catalog_options")
      .select("id, asset_id, level_no, parent_id, value, price, raw_price, sort_order")
      .eq("asset_id", id),
  ]);
  if (levels.error) throw levels.error;
  if (options.error) throw options.error;
  return {
    assets: [asset as CatalogAssetRow],
    levels: (levels.data ?? []) as CatalogLevelRow[],
    options: (options.data ?? []) as CatalogOptionRow[],
  };
}
