/**
 * POST /api/admin/expenses/scan
 *
 * One-shot endpoint for the "Upload Invoice" flow:
 *   1. Receive the receipt image (multipart form-data, field "file")
 *   2. Upload it to Vercel Blob → get a public URL
 *   3. Send to Claude vision for OCR → get structured invoice data
 *   4. Return { receiptUrl, parsed } so the admin form can pre-fill
 *
 * The expense itself is NOT created here — admin reviews + edits the
 * parsed data, then POSTs to /api/admin/expenses with their final values
 * and the receiptUrl from this response.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { storeImage } from "@/lib/upload";
import { requireAdmin } from "@/lib/admin-auth";
import { parseInvoiceImage } from "@/lib/expense-ocr";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;  // 8MB
const ALLOWED   = ["image/jpeg", "image/png", "image/webp"] as const;

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES)   return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 400 });
  if (!ALLOWED.includes(file.type as typeof ALLOWED[number])) {
    return NextResponse.json({ error: `unsupported type: ${file.type}` }, { status: 400 });
  }

  // ── 1. Read bytes once (used for both the R2 upload and OCR) ─────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `expense/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const receiptUrl = await storeImage(key, buffer, file.type);

  // ── 2. Base64 for Claude vision ─────────────────────────────────────────
  const imageBase64 = buffer.toString("base64");

  // ── 3. Parse with Claude ────────────────────────────────────────────────
  try {
    const parsed = await parseInvoiceImage(
      imageBase64,
      file.type as "image/jpeg" | "image/png" | "image/webp",
    );
    return NextResponse.json({ receiptUrl, parsed });
  } catch (e) {
    console.error("[expenses/scan] OCR failed", e);
    // Image is still uploaded — return the URL so admin can fill in manually.
    return NextResponse.json(
      {
        receiptUrl,
        parsed: null,
        error:  e instanceof Error ? e.message : "OCR failed",
      },
      { status: 200 },  // not a fatal error — admin can still proceed manually
    );
  }
}
