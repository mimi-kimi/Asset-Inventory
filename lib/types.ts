export type Role = "ADMIN" | "INSPECTOR";
export type AssetStatus = "ACTIVE" | "INACTIVE";
export type Condition = "GOOD" | "FAIR" | "BAD";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
  username?: string | null;
  email?: string | null;
  active?: boolean;
  must_change_password?: boolean;
}

export interface TaskRow {
  id: string;
  name: string;
  imported_by: string | null;
  row_count: number;
  created_at: string;
}

/* ---------- asset catalog: assets (L1) → levels (L2..L6) → options (+ price) ---------- */

/** L1 — a catalog asset, e.g. "LAMPU JALAN". */
export interface CatalogAssetRow {
  id: string;
  name: string;
  sort_order: number;
  /** heading of the price column, e.g. "HARGA" (defaults to "HARGA" in the UI) */
  price_label?: string | null;
  created_at?: string;
}

/** A named level of one asset (L2..L6) — the heading the options live under. */
export interface CatalogLevelRow {
  id: string;
  asset_id: string;
  level_no: number;
  label: string;
}

/**
 * One selectable value. Options form a tree: `parent_id` is the option chosen at
 * the level above (null for the first level). The price is only meaningful on a
 * leaf (a value with no children) — that node is one full combination.
 */
export interface CatalogOptionRow {
  id: string;
  asset_id: string;
  level_no: number;
  parent_id: string | null;
  value: string;
  price: number | null;
  raw_price?: string | null;
  sort_order: number;
}

export interface CatalogData {
  assets: CatalogAssetRow[];
  levels: CatalogLevelRow[];
  options: CatalogOptionRow[];
}

/** One step of `inspections.catalog_path` — the snapshot of what was picked. */
export interface CatalogPathStep {
  level_no: number;
  label?: string | null;
  value: string;
  option_id?: string | null;
}

/** An asset row (the category is `type_text`, set from the catalog). */
export interface AssetRow {
  id: string;
  code: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  status: AssetStatus;
  photo_url: string | null;
  installed_date: string | null;
  notes: string | null;
  created_at: string;
  /* v2 task/import fields */
  task_id?: string | null;
  seq_no?: string | null;
  inventory_id?: string | null;
  price?: number | null;
  type_text?: string | null;
  tasks?: Pick<TaskRow, "id" | "name"> | null;
  inspections?: Array<{
    id: string;
    functional: boolean;
    inspected_at: string;
    condition?: Condition | null;
    remarks?: string | null;
    inspector_id?: string | null;
    created_at?: string;
    photo_webp?: string | null;
    photo_url?: string | null;
    photo_path?: string | null;
    price?: number | null;
    price_manual?: boolean | null;
    asset_category?: string | null;
    catalog_asset_id?: string | null;
    catalog_path?: CatalogPathStep[] | null;
    l2?: string | null;
    l3?: string | null;
    l4?: string | null;
    l5?: string | null;
    l6?: string | null;
    other_description?: string | null;
  }> | null;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  photo_url: string;
}

/** An inspection joined with its asset, inspector profile and photos. */
export interface InspectionRow {
  id: string;
  asset_id: string;
  inspector_id: string;
  inspected_at: string;
  condition: Condition;
  functional: boolean;
  remarks: string | null;
  photo_webp?: string | null;
  /** public Storage URL of the mobile photo (preferred) */
  photo_url?: string | null;
  /** object path inside the bucket, for replace/delete */
  photo_path?: string | null;
  /* v5 catalog selections */
  catalog_asset_id?: string | null;
  asset_category?: string | null;
  catalog_path?: CatalogPathStep[] | null;
  l2?: string | null;
  l3?: string | null;
  l4?: string | null;
  l5?: string | null;
  l6?: string | null;
  price?: number | null;
  price_manual?: boolean;
  other_description?: string | null;
  created_at?: string;
  assets?: {
    id: string;
    code: string;
    seq_no?: string | null;
    inventory_id?: string | null;
    type_text?: string | null;
    location: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  inspection_photos?: InspectionPhoto[];
}

