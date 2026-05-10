import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * POST /api/upload?kind=receipt|profile&ref=<id>
 * Body: raw image file (multipart form-data with field "file").
 * Returns: { url: string }
 */
export async function POST(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const ref  = url.searchParams.get("ref");
  if (!kind || !ref) return NextResponse.json({ error: "missing kind/ref" }, { status: 400 });
  if (!["receipt", "profile", "customer-photo"].includes(kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "unsupported type" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `${kind}/${ref}/${Date.now()}.${ext}`;

  const blob = await put(key, file, {
    access:           "public",
    contentType:      file.type,
    addRandomSuffix:  false,
    allowOverwrite:   true,
  });

  return NextResponse.json({ url: blob.url });
}
