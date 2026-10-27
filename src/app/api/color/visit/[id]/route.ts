import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OPT, cleanZones, colorActor, developerGramsOf, formulaCostSatang } from "@/lib/color";

/**
 * PATCH /api/color/visit/[id] — save the colour record (partial). `finish: true`
 * marks it done. Cost is computed here for the admin reports and never returned.
 * DELETE — remove a record that is still a draft.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const v = await prisma.colorVisit.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!v) return NextResponse.json({ error: "ไม่พบบันทึก" }, { status: 404 });

  const has = (k: string) => k in b;
  const many = (k: string, allowed: readonly string[]) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string" && allowed.includes(x)) : []);
  const int = (k: string, min: number, max: number) => { const x = b[k]; if (x === "" || x == null) return null; const n = Math.round(Number(x)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };
  const text = (k: string, max = 500) => (typeof b[k] === "string" && (b[k] as string).trim() ? (b[k] as string).trim().slice(0, max) : null);
  const urls = (k: string) => (Array.isArray(b[k]) ? (b[k] as unknown[]).filter((x): x is string => typeof x === "string" && /^https:\/\//.test(x)).slice(0, 12) : []);

  const data: Record<string, unknown> = {};
  if (has("serviceTypes")) data.serviceTypes = many("serviceTypes", OPT.service);
  if (has("preChecks")) data.preChecks = many("preChecks", OPT.preCheck);
  for (const [k, min, max] of [["rootLevel", 1, 12], ["midEndsLevel", 1, 12], ["targetLevel", 1, 12], ["grayPercent", 0, 100]] as const) if (has(k)) data[k] = int(k, min, max);
  if (has("patchTestNeeded")) data.patchTestNeeded = b.patchTestNeeded === true;
  if (has("otherProducts")) data.otherProducts = text("otherProducts", 300);
  if (has("result")) data.result = ["ON_TARGET", "DARKER", "LIGHTER", "NEEDS_FIX"].includes(String(b.result)) ? String(b.result) : null;
  if (has("scalpAfter")) data.scalpAfter = typeof b.scalpAfter === "string" && (OPT.scalpAfter as readonly string[]).includes(b.scalpAfter) ? b.scalpAfter : null;
  if (has("nextTimeNotes")) data.nextTimeNotes = text("nextTimeNotes", 1000);
  for (const k of ["referencePhotos", "beforePhotos", "afterPhotos"]) if (has(k)) data[k] = urls(k);
  if (has("zones")) {
    const zones = cleanZones(b.zones);
    data.zones = zones;
    data.colorGrams = zones.reduce((s, z) => s + z.shades.reduce((t, x) => t + x.grams, 0), 0);
    data.developerGrams = zones.reduce((s, z) => s + developerGramsOf(z), 0);
    data.costSatang = await formulaCostSatang(zones);
  }
  if (b.finish === true) { data.status = "DONE"; data.completedAt = new Date(); }
  if (b.reopen === true) { data.status = "DRAFT"; data.completedAt = null; }

  await prisma.colorVisit.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await prisma.colorVisit.deleteMany({ where: { id, status: "DRAFT" } });
  if (!r.count) return NextResponse.json({ error: "ลบได้เฉพาะบันทึกที่ยังไม่เสร็จ" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
