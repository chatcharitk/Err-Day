/**
 * Client-side image resize (browser only). Draws the picked image onto a canvas
 * capped at `maxDim` and re-encodes as JPEG. Two reasons:
 *   1. Vercel serverless functions reject request bodies > 4.5 MB, and uploads
 *      pass through the function — so a big phone photo must be shrunk first.
 *   2. Smaller files = less storage + faster uploads.
 * Falls back to the original file if it's already small, not an image, or if
 * anything fails (e.g. a format the browser can't decode).
 */
export async function resizeImageFile(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload  = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    // Already small enough — keep as-is.
    if (img.width <= maxDim && img.height <= maxDim && file.size < 1_000_000) return file;

    const scale  = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width  = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
