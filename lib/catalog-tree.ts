import type {
  CatalogAssetRow,
  CatalogData,
  CatalogLevelRow,
  CatalogOptionRow,
  CatalogPathStep,
} from "@/lib/types";

/** Deepest descriptor level the schema allows (the price sits on top of these). */
export const MAX_LEVEL = 6;

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export interface CatalogAssetTree extends CatalogAssetRow {
  levels: CatalogLevelRow[];
  options: CatalogOptionRow[];
  childrenByParent: Map<string | null, CatalogOptionRow[]>;
  optionById: Map<string, CatalogOptionRow>;
  parentById: Map<string, string | null>;
}

export interface CatalogTree {
  assets: CatalogAssetTree[];
  byId: Map<string, CatalogAssetTree>;
  byName: Map<string, CatalogAssetTree>;
}

/** Group flat `catalog_*` rows into a per-asset tree (parents → children). */
export function buildTree(data: CatalogData): CatalogTree {
  const levelRows = new Map<string, CatalogLevelRow[]>();
  for (const level of data.levels) {
    const list = levelRows.get(level.asset_id);
    if (list) list.push(level);
    else levelRows.set(level.asset_id, [level]);
  }

  const optionRows = new Map<string, CatalogOptionRow[]>();
  for (const option of data.options) {
    const list = optionRows.get(option.asset_id);
    if (list) list.push(option);
    else optionRows.set(option.asset_id, [option]);
  }

  const assets = [...data.assets]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map<CatalogAssetTree>((asset) => {
      const levels = [...(levelRows.get(asset.id) ?? [])].sort(
        (a, b) => a.level_no - b.level_no,
      );
      const options = [...(optionRows.get(asset.id) ?? [])].sort(
        (a, b) =>
          a.level_no - b.level_no ||
          a.sort_order - b.sort_order ||
          a.value.localeCompare(b.value),
      );
      const childrenByParent = new Map<string | null, CatalogOptionRow[]>();
      const optionById = new Map<string, CatalogOptionRow>();
      const parentById = new Map<string, string | null>();
      for (const option of options) {
        optionById.set(option.id, option);
        parentById.set(option.id, option.parent_id);
        const list = childrenByParent.get(option.parent_id);
        if (list) list.push(option);
        else childrenByParent.set(option.parent_id, [option]);
      }
      return { ...asset, levels, options, childrenByParent, optionById, parentById };
    });

  return {
    assets,
    byId: new Map(assets.map((asset) => [asset.id, asset])),
    byName: new Map(assets.map((asset) => [normalize(asset.name), asset])),
  };
}

/** Find an asset by id, or by its (case/space-insensitive) name. */
export function matchAsset(
  tree: CatalogTree,
  nameOrId: string | null | undefined,
): CatalogAssetTree | null {
  if (!nameOrId) return null;
  return tree.byId.get(nameOrId) ?? tree.byName.get(normalize(nameOrId)) ?? null;
}

export function childrenOf(
  asset: CatalogAssetTree,
  parentId: string | null,
): CatalogOptionRow[] {
  return asset.childrenByParent.get(parentId) ?? [];
}

export function optionsAtLevel(
  asset: CatalogAssetTree,
  levelNo: number,
): CatalogOptionRow[] {
  return asset.options.filter((option) => option.level_no === levelNo);
}

export function levelLabel(
  asset: CatalogAssetTree,
  levelNo: number,
): string | null {
  return asset.levels.find((level) => level.level_no === levelNo)?.label ?? null;
}

/** Deepest level that has a label and/or options. */
export function deepestLevel(asset: CatalogAssetTree): number {
  return asset.options.reduce(
    (max, option) => Math.max(max, option.level_no),
    asset.levels.reduce((max, level) => Math.max(max, level.level_no), 1),
  );
}

/** Next level to create when the admin presses "Add level". */
export function nextLevelNo(asset: CatalogAssetTree): number {
  return Math.min(MAX_LEVEL, deepestLevel(asset) + 1);
}

/** Values that end a combination (they have no children of their own). */
export function leafOptions(asset: CatalogAssetTree): CatalogOptionRow[] {
  return asset.options.filter((option) => childrenOf(asset, option.id).length === 0);
}

export function isLeaf(asset: CatalogAssetTree, option: CatalogOptionRow): boolean {
  return childrenOf(asset, option.id).length === 0;
}

/** Root → node chain of an option (includes the option itself). */
export function pathOf(
  asset: CatalogAssetTree,
  optionId: string,
): CatalogOptionRow[] {
  const chain: CatalogOptionRow[] = [];
  let current: string | null = optionId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const option = asset.optionById.get(current);
    if (!option) break;
    chain.unshift(option);
    current = option.parent_id;
  }
  return chain;
}

/** Deepest non-null price along a root → leaf chain (kept for older records). */
export function priceOfPath(nodes: CatalogOptionRow[]): {
  price: number | null;
  node: CatalogOptionRow | null;
  raw: string | null;
} {
  let price: number | null = null;
  let node: CatalogOptionRow | null = null;
  for (const candidate of nodes) {
    if (candidate.price !== null && candidate.price !== undefined) {
      price = candidate.price;
      node = candidate;
    }
  }
  return { price, node, raw: node?.raw_price ?? null };
}

/** The price of a picked combination — it lives on the last value (L6). */
export function leafPrice(node: CatalogOptionRow | null | undefined): number | null {
  return node && node.price !== null && node.price !== undefined ? node.price : null;
}

/** Heading of the price column for an asset ("HARGA" by default). */
export function priceHeading(asset: { price_label?: string | null }): string {
  return (asset.price_label ?? "").trim() || "HARGA";
}

/** The picked chain (level number → option id), dropping ids that don't chain. */
export function selectionPath(
  asset: CatalogAssetTree,
  selection: Record<number, string | undefined>,
): CatalogOptionRow[] {
  const nodes: CatalogOptionRow[] = [];
  let parentId: string | null = null;
  for (let level = 2; level <= MAX_LEVEL; level += 1) {
    const picked = selection[level];
    if (!picked) break;
    const option = asset.optionById.get(picked);
    if (!option || option.parent_id !== parentId) break;
    nodes.push(option);
    parentId = option.id;
  }
  return nodes;
}

/** Snapshot stored on `inspections.catalog_path`. */
export function pathSteps(
  asset: CatalogAssetTree,
  nodes: CatalogOptionRow[],
): CatalogPathStep[] {
  return nodes.map((node) => ({
    level_no: node.level_no,
    label: levelLabel(asset, node.level_no),
    value: node.value,
    option_id: node.id,
  }));
}

/** Every root → leaf combination of an asset, with its price. */
export function combinations(
  asset: CatalogAssetTree,
): { nodes: CatalogOptionRow[]; price: number | null }[] {
  const out: { nodes: CatalogOptionRow[]; price: number | null }[] = [];

  const walk = (parentId: string | null, path: CatalogOptionRow[]) => {
    const children = childrenOf(asset, parentId);
    if (children.length === 0) {
      if (path.length > 0) {
        out.push({ nodes: path, price: leafPrice(path[path.length - 1]) });
      }
      return;
    }
    for (const child of children) walk(child.id, [...path, child]);
  };

  walk(null, []);
  return out;
}

export function coverageOf(asset: CatalogAssetTree): {
  combinations: number;
  priced: number;
} {
  const all = combinations(asset);
  return {
    combinations: all.length,
    priced: all.filter((item) => item.price !== null).length,
  };
}

/** Stable key for one path: asset + ancestor values + value, all normalised. */
export function pathKey(
  assetId: string,
  ancestorValues: string[],
  value: string,
): string {
  return [assetId, ...ancestorValues.map(normalize), normalize(value)].join("\u0001");
}

/** Key of an existing option (walks up its parents). */
export function optionPathKey(
  asset: CatalogAssetTree,
  option: CatalogOptionRow,
): string {
  const ancestors = pathOf(asset, option.id).slice(0, -1);
  return pathKey(asset.id, ancestors.map((node) => node.value), option.value);
}
