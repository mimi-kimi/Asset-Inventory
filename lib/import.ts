import * as XLSX from "xlsx";

/** One parsed row from a task import file. */
export interface ImportRow {
  line: number; // line in the file (1-based) for error messages
  seq_no: string;
  inventory_id: string;
  lng: number | null;
  lat: number | null;
  price: number | null;
  type_text: string;
  remarks: string;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: string[];
  skippedHeader: boolean;
  sheetName: string;
}

/**
 * Column layout (exactly as agreed):
 *   A = No            B = ID-Inventory   C = Position_X (longitude)
 *   D = Position_Y (latitude)  E = Price   F = Type   G = Remarks
 */

function cell(row: unknown[], index: number): string {
  const v = row[index];
  if (v === null || v === undefined) return "";
  return typeof v === "number" ? String(v) : String(v).trim();
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  // tolerate currency formatting like 1,250.00 / ₱1,250
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function looksLikeHeader(row: unknown[]): boolean {
  const first = cell(row, 0).toLowerCase();
  return (
    /^no\b/.test(first) ||
    /inventory/.test(cell(row, 1).toLowerCase()) ||
    /position|x/i.test(cell(row, 2))
  );
}

export function parseTaskFile(buffer: ArrayBuffer): ParseResult {
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  let skippedHeader = false;

  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0] ?? "";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { rows, errors: ["The file has no readable sheet."], skippedHeader, sheetName };
  }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  let start = 0;
  if (raw.length > 0 && looksLikeHeader(raw[0])) {
    skippedHeader = true;
    start = 1;
  }

  for (let i = start; i < raw.length; i += 1) {
    const row = raw[i] ?? [];
    const line = i + 1;
    const seq_no = cell(row, 0);
    const inventory_id = cell(row, 1);
    const xRaw = cell(row, 2);
    const yRaw = cell(row, 3);
    const price = toNumber(cell(row, 4));
    const type_text = cell(row, 5);
    const remarks = cell(row, 6);

    if (!seq_no && !inventory_id && !xRaw && !yRaw) continue; // blank row

    const lng = toNumber(xRaw);
    const lat = toNumber(yRaw);

    if (lng === null || lat === null || Number.isNaN(lng) || Number.isNaN(lat)) {
      errors.push(`Row ${line}: invalid Position_X / Position_Y coordinates (${xRaw || "-"}, ${yRaw || "-"}).`);
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push(`Row ${line}: coordinates out of range (${lng}, ${lat}).`);
      continue;
    }
    if (price !== null && (Number.isNaN(price) || price < 0)) {
      errors.push(`Row ${line}: invalid price "${cell(row, 4)}".`);
      continue;
    }

    rows.push({
      line,
      seq_no,
      inventory_id,
      lng,
      lat,
      price,
      type_text,
      remarks,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No rows found in the file.");
  }

  return { rows, errors, skippedHeader, sheetName };
}
