import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONSENT_VERSION, colorActor } from "@/lib/color";

/**
 * POST /api/color/profile — the two small things kept per customer (the long
 * intake questionnaire was dropped): a one-line caution (allergy / sensitivity)
 * and the customer's tap to allow us to keep photos + this note (PDPA).
 *   { customerId, caution?: string, consent?: true }
 * Only the fields sent are changed; the note needs consent (existing or in the
 * same request).
 */
export async function POST(request: Request) {
  const actor = await colorActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const customerId = typeof b?.customerId === "string" ? b.customerId : "";
  if (!b || !customerId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  if (!await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } })) return NextResponse.json({ error: "ไม่พบลูกค้า" }, { status: 404 });

  const existing = await prisma.hairProfile.findUnique({ where: { customerId }, select: { consentAt: true } });
  const hasConsent = !!existing?.consentAt || b.consent === true;
  if (!hasConsent) return NextResponse.json({ error: "ต้องให้ลูกค้ากดยินยอมก่อนบันทึกข้อมูล" }, { status: 400 });

  const data: Record<string, unknown> = { assessedBy: actor.name };
  if (!existing?.consentAt) { data.consentAt = new Date(); data.consentVersion = CONSENT_VERSION; }
  if ("caution" in b) {
    const t = typeof b.caution === "string" && b.caution.trim() ? b.caution.trim().slice(0, 200) : null;
    data.allergy = t ? "YES" : "UNKNOWN";
    data.allergyDetail = t;
  }
  const profile = await prisma.hairProfile.upsert({ where: { customerId }, create: { customerId, ...data }, update: data });
  return NextResponse.json({ ok: true, id: profile.id });
}
