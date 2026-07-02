/**
 * Single entry point for storing an image. Uses Cloudflare R2 when configured
 * (the new default) and falls back to Vercel Blob otherwise — so a deploy can
 * never break uploads if the R2 env vars aren't set yet.
 */
import { put } from "@vercel/blob";
import { uploadToR2, isR2Configured } from "@/lib/r2";

export async function storeImage(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  if (isR2Configured()) {
    return uploadToR2(key, buf, contentType);
  }
  const blob = await put(key, buf, {
    access:          "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite:  true,
  });
  return blob.url;
}
