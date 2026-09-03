/**
 * The selling company's legal identity, as printed on receipts.
 *
 * A single row (id = "company") seeded by the migration. Reads are open to any
 * admin; writes are owner-only — this is the legal header on every tax document.
 */
import { NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const COMPANY_ID = "company";

/** Never 404 the settings screen just because the seed row is missing. */
async function loadOrCreate() {
  const existing = await prisma.companyProfile.findUnique({ where: { id: COMPANY_ID } });
  if (existing) return existing;
  return prisma.companyProfile.create({ data: { id: COMPANY_ID } });
}

export async function GET() {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  return NextResponse.json(await loadOrCreate());
}

export async function PATCH(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;

  try {
    const body = await request.json();
    const {
      legalName, legalNameEn, taxId, addressLine, phone,
      vatRegistered, vatRatePercent, receiptFooterTh,
    } = body;

    // A Thai tax ID is exactly 13 digits — reject anything else rather than let
    // a malformed number reach a printed document.
    if (taxId !== undefined && String(taxId).trim() !== "") {
      const digits = String(taxId).replace(/\D/g, "");
      if (digits.length !== 13) {
        return NextResponse.json(
          { error: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก" },
          { status: 400 },
        );
      }
    }
    if (vatRatePercent !== undefined) {
      const n = Number(vatRatePercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json({ error: "อัตราภาษีไม่ถูกต้อง" }, { status: 400 });
      }
    }

    await loadOrCreate();
    const profile = await prisma.companyProfile.update({
      where: { id: COMPANY_ID },
      data: {
        ...(legalName       !== undefined ? { legalName:   String(legalName).trim() }        : {}),
        ...(legalNameEn     !== undefined ? { legalNameEn: String(legalNameEn).trim() || null } : {}),
        ...(taxId           !== undefined ? { taxId:       String(taxId).replace(/\D/g, "") } : {}),
        ...(addressLine     !== undefined ? { addressLine: String(addressLine).trim() }      : {}),
        ...(phone           !== undefined ? { phone:       String(phone).trim() || null }    : {}),
        ...(vatRegistered   !== undefined ? { vatRegistered: Boolean(vatRegistered) }        : {}),
        ...(vatRatePercent  !== undefined ? { vatRatePercent: Math.round(Number(vatRatePercent)) } : {}),
        ...(receiptFooterTh !== undefined ? { receiptFooterTh: String(receiptFooterTh).trim() || null } : {}),
      },
    });

    // Already-issued receipts keep their own snapshot — this only affects
    // documents issued from now on.
    return NextResponse.json(profile);
  } catch (error) {
    console.error("[company-profile PATCH]", error);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
