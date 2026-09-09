export type Role = "ADMIN" | "INSPECTOR";
export type AssetStatus = "ACTIVE" | "INACTIVE";
export type Condition =
  | "GOOD"
  | "FAIR"
  | "POOR"
  | "DAMAGED"
  | "NOT_FUNCTIONAL";

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface TaskRow {
  id: string;
  name: string;
  imported_by: string | null;
  row_count: number;
  created_at: string;
}

export interface AssetType {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  created_at?: string;
}

/** An asset row joined with its type (select *, asset_types(*)). */
export interface AssetRow {
  id: string;
  code: string;
  type_id: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  status: AssetStatus;
  photo_url: string | null;
  installed_date: string | null;
  notes: string | null;
  created_at: string;
  asset_types?: Pick<AssetType, "id" | "code" | "name" | "icon"> | null;
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
  created_at?: string;
  assets?: {
    id: string;
    code: string;
    location: string | null;
    lat: number | null;
    lng: number | null;
    asset_types?: Pick<AssetType, "id" | "code" | "name" | "icon"> | null;
  } | null;
  inspection_photos?: InspectionPhoto[];
}

