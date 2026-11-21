import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendMembershipDetails } from "@/lib/notifications";

/**
 * POST → (re)send the membership LINE card to this customer by hand — for when
 * the automatic card after a POS sale / renewal failed or never went out.
 * Always pushes (no once-only guard): the admin asked for it explicitly.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const r = await sendMembershipDetails(id);
  return NextResponse.json(r, { status: r.status === "FAILED" ? 502 : 200 });
}
