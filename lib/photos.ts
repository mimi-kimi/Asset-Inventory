/**
 * Where a report's photos live. v6 moved the mobile photo onto the inspection
 * row as a Storage URL (`photo_url`, with the object path in `photo_path`);
 * older rows still carry base64 (`photo_webp`) or rows in `inspection_photos`.
 * Display code should ask here instead of counting the legacy table.
 */
export interface PhotoFields {
  photo_url?: string | null;
  photo_webp?: string | null;
  inspection_photos?: { photo_url: string | null }[] | null;
}

/** Every photo URL of a report, newest first (Storage URL, base64, legacy rows). */
export function inspectionPhotoUrls(inspection: PhotoFields | null | undefined): string[] {
  if (!inspection) return [];
  const urls: string[] = [];
  if (inspection.photo_url) urls.push(inspection.photo_url);
  /* base64 rows are only worth showing when there is no Storage URL */
  if (!inspection.photo_url && inspection.photo_webp) urls.push(inspection.photo_webp);
  for (const photo of inspection.inspection_photos ?? []) {
    if (photo.photo_url) urls.push(photo.photo_url);
  }
  return urls;
}

export function inspectionPhotoCount(
  inspection: PhotoFields | null | undefined,
): number {
  return inspectionPhotoUrls(inspection).length;
}

/** "📷 2" style label used in the lists. */
export function photoLabel(inspection: PhotoFields | null | undefined): string {
  const count = inspectionPhotoCount(inspection);
  return count === 0 ? "—" : `📷 ${count}`;
}
