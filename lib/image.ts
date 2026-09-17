/**
 * Reads an image File, downsizes it, and encodes it as a WebP data URL.
 * This keeps inspection photos small enough to store as base64 text
 * directly on the inspection row.
 */
export async function fileToWebpDataUrl(
  file: File,
  maxSize = 960,
  quality = 0.72,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas is not supported in this browser.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/webp", quality);
  if (!dataUrl.startsWith("data:image/webp")) {
    throw new Error("WebP encoding is not supported in this browser.");
  }
  return dataUrl;
}

/** A downscaled WebP ready to upload (plus a local preview URL). */
export interface WebpPhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Downscales the photo to `maxSize` on its longest side and encodes WebP, so a
 * phone snapshot (several MB) becomes ~100 KB before it is uploaded to Storage.
 */
export async function fileToWebpBlob(
  file: File,
  maxSize = 1280,
  quality = 0.7,
): Promise<WebpPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas is not supported in this browser.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) {
    throw new Error("WebP encoding is not supported in this browser.");
  }
  return { blob, previewUrl: URL.createObjectURL(blob), width, height, bytes: blob.size };
}
