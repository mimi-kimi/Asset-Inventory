/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Source:      Aset perambot jalan.xlsx
 * Sheet:       Sheet1
 * Generated:   2026-09-17T02:19:40.436Z
 * Structure:   8 assets · 132 combinations · 10 without a price
 *
 * Only the L1..L5 *structure* lives here. Prices are stored in Supabase
 * (`public.catalog_prices`, keyed by `asset_key` + l2..l5) so admins can update
 * them from Dashboard → Catalog without a redeploy.
 *
 * Regenerate after changing the spreadsheet:  npm run catalog:gen -- "Aset perambot jalan.xlsx"
 */

export interface CatalogAssetDef {
  /** stable slug used as `catalog_prices.asset_key` and `inspections.catalog_asset_key` */
  key: string;
  /** display name, also stored on `inspections.asset_category` */
  name: string;
  /** level number (2..5) → label from the sheet's block header */
  labels: Partial<Record<2 | 3 | 4 | 5, string>>;
  /** level number → selectable values, in sheet order */
  options: Partial<Record<2 | 3 | 4 | 5, string[]>>;
}

export const CATALOG_META = {
  sourceFile: "Aset perambot jalan.xlsx",
  sheet: "Sheet1",
  generatedAt: "2026-09-17T02:19:40.436Z",
  assetCount: 8,
  combinationCount: 132,
  pricedCount: 122,
} as const;

export const CATALOG_ASSETS: CatalogAssetDef[] = [
  {
    key: "lampu-jalan",
    name: "LAMPU JALAN",
    labels: {
      2: "KETERANGAN",
      3: "ARM",
      4: "WATT",
      5: "TIANG",
    },
    options: {
      2: [
        "8M",
        "10M",
        "12M",
        "15M",
      ],
      3: [
        "1 ARM",
        "2 ARMS",
        "3 ARMS",
        "4 ARMS",
        "LAIN-LAIN",
      ],
      4: [
        "70W",
        "150W",
        "250W",
        "400W",
        "LAIN-LAIN",
      ],
      5: [
        "ATC",
        "GAL",
        "TNB",
        "LAIN-LAIN",
      ],
    },
  },
  {
    key: "lampu-isyarat",
    name: "LAMPU ISYARAT",
    labels: {
      2: "KETERANGAN",
      3: "TIANG",
      4: "SIMPANG",
      5: "TIANG",
    },
    options: {
      2: [
        "6M",
        "7M",
      ],
      3: [
        "NORMAL",
        "ARM",
        "LAIN-LAIN",
        "LAIN LAIN",
      ],
      4: [
        "3 / 4",
        "BULATAN",
        "PEJALAN KAKI",
        "LAIN -LAIN",
        "3",
        "4",
        "LAIN-LAIN",
      ],
      5: [
        "GAL",
      ],
    },
  },
  {
    key: "feeder-pillar-lampu-jalan",
    name: "FEEDER PILLAR LAMPU JALAN",
    labels: {
      2: "AMP",
    },
    options: {
      2: [
        "30A",
        "60A",
        "100A",
        "LAIN-LAIN",
      ],
    },
  },
  {
    key: "feeder-pillar-lampu-isyarat",
    name: "FEEDER PILLAR LAMPU ISYARAT",
    labels: {
      2: "AMP",
    },
    options: {
      2: [
        "30A",
        "60A",
        "100A",
        "LAIN-LAIN",
      ],
    },
  },
  {
    key: "feeder-pillar-gantung-tiang",
    name: "FEEDER PILLAR GANTUNG TIANG",
    labels: {
      2: "AMP",
    },
    options: {
      2: [
        "30A",
        "60A",
        "100A",
        "LAIN-LAIN",
      ],
    },
  },
  {
    key: "papan-tanda-jalan",
    name: "PAPAN TANDA JALAN",
    labels: {
      2: "JENIS",
      3: "WARNA",
      4: "KRETERIA / MAKLUMAN",
    },
    options: {
      2: [
        "LARANGAN",
        "MANDATORI",
        "AMARAN / AWAS",
        "MAKLUMAT/PANDUAN",
        "ZON KERJA JALAN (SEMENTARA)",
        "MAKLUMAN",
      ],
      3: [
        "MERAH",
        "BIRU",
        "KUNING",
        "HIJAU",
        "OREN",
        "COKLAT",
      ],
      4: [
        "BERHENTI",
        "DILARANG MASUK",
        "DILARANG MEMBELOK",
        "DILARANG PUSINGAN - U",
        "DILARANG MEMOTONG",
        "DILARANG MELETAK KENDERAAN",
        "DILARANG BERHENTI",
        "HAD LAJU",
        "DILARANG MOTOSIKAL",
        "ARAH JALAN",
        "BULATAN BEPUSING",
        "LALUAN BASIKAL",
        "LORONG MOTOSIKAL",
        "KAWASAN  DIBENARKAN PARKIR",
        "JALAN PERSEKUTUAN / NEGERI",
        "SELEKOH TAJAM DI HADAPAN",
        "JALAN BERLIKU",
        "SIMPANG EMPAT",
        "JALAN LICIN",
        "KAWASAN SEKOLAH",
        "LINTASAN PEJALAN KAKI",
        "JALAN TIDAK RATA",
        "JALAN MENYEMPIT",
        "PENDAKIAN / PENURUNAN CURAM",
        "LINTASAN KERETA API",
        "LEBUHRAYA / LEBUHRAYA BERTOL",
        "1200 X 600 MM",
        "1800 X 900 MM",
        "2400 X 1200 MM",
        "3000 X 1500 MM",
        "SEMENTARA/PEMBINAAN",
        "914 X 1219 MM",
        "TEMPAT PELANCONGAN / REKREASI",
      ],
    },
  },
  {
    key: "kiosk",
    name: "KIOSK",
    labels: {
      2: "KATEGORI",
    },
    options: {
      2: [
        "PONDOK BAS",
        "PONDOK BAS DAN KIOSK PENJAJA",
        "LAIN LAIN",
      ],
    },
  },
  {
    key: "lain-lain",
    name: "LAIN-LAIN",
    labels: {
      2: "KATEGORI",
      3: "JENIS",
    },
    options: {
      2: [
        "BOLLARD",
      ],
      3: [
        "PVC",
        "GAL",
      ],
    },
  },
];

export const CATALOG_BY_KEY: Record<string, CatalogAssetDef> = Object.fromEntries(
  CATALOG_ASSETS.map((asset) => [asset.key, asset]),
);

/** Find an asset by its (case/space-insensitive) name, or by its key. */
export function matchCatalogAsset(
  name: string | null | undefined,
): CatalogAssetDef | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase().replace(/\s+/g, " ");
  for (const asset of CATALOG_ASSETS) {
    if (asset.name.toLowerCase().replace(/\s+/g, " ") === wanted) return asset;
    if (asset.key === name.trim().toLowerCase()) return asset;
  }
  return null;
}

/** Levels that exist for an asset, ascending. */
export function levelsOf(
  asset: CatalogAssetDef,
): { level: 2 | 3 | 4 | 5; label: string }[] {
  return ([2, 3, 4, 5] as const)
    .filter((level) => asset.labels[level] !== undefined)
    .map((level) => ({ level, label: asset.labels[level] as string }));
}
