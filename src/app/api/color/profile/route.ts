import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONSENT_VERSION, OPT, colorActor } from "@/lib/color";

/**
 * POST /api/color/profile — save a customer's hair profile (page 1 of the colour
 * record), asked at the salon. Allergy answers are health data, so the first
 * save needs the customer's consent (`consent: true`, tapped on the salon device).
 */
export async function POST(request: Request) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const customerId = typeof b?.customerId === "string" ? b.customerId : "";
  if (!b || !customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });

  const existing = await prisma.hairProfile.findUnique({ where: { customerId }, select: { consentAt: true, patchTestResult: true } });
  if (!existing?.consentAt && b.consent !== true) {
    return NextResponse.json({ error: "ต้องให้ลูกค้ากดยินยอมก่อนบันทึกข้อมูล" }, { status: 400 });
  }

  const one = (v: unknown, allowed: readonly string[]) => (typeof v === "string" && allowed.includes(v) ? v : null);
  const many = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)) : []);
  const text = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const int = (v: unknown, min: number, max: number) => { if (v === "" || v == null) return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null; };
  const allergy = ["NONE", "YES", "UNSURE", "UNKNOWN"].includes(String(b.allergy)) ? String(b.allergy) : "UNKNOWN";
  const patch = ["PASS", "FAIL"].includes(String(b.patchTestResult)) ? String(b.patchTestResult) : null;

  const data = {
    naturalLevel: int(b.naturalLevel, 1, 10), grayPercent: int(b.grayPercent, 0, 100),
    length: one(b.length, OPT.length), texture: one(b.texture, OPT.texture), curl: one(b.curl, OPT.curl), density: one(b.density, OPT.density),
    condition: many(b.condition, OPT.condition), scalp: many(b.scalp, OPT.scalp), chemicalHistory: many(b.chemicalHistory, OPT.chemical),
    lastChemical: one(b.lastChemical, OPT.lastChem), lastChemicalProduct: text(b.lastChemicalProduct, 120),
    allergy, allergyDetail: allergy === "NONE" ? null : text(b.allergyDetail),
    preferredTones: text(b.preferredTones, 120), avoidTones: text(b.avoidTones, 120), goals: text(b.goals),
    consentMarketing: b.consentMarketing === true,
    assessedBy: actor.name,
    ...(patch && patch !== existing?.patchTestResult ? { patchTestResult: patch, patchTestAt: new Date(), patchTestBy: actor.name } : {}),
    ...(patch === null && b.patchTestResult === "" ? { patchTestResult: null, patchTestAt: null, patchTestBy: null } : {}),
    ...(!existing?.consentAt ? { consentAt: new Date(), consentVersion: CONSENT_VERSION } : {}),
  };
  const profile = await prisma.hairProfile.upsert({ where: { customerId }, create: { customerId, ...data }, update: data });
  return NextResponse.json({ ok: true, id: profile.id });
}
