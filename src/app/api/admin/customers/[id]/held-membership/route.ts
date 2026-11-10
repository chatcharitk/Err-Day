import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { loadHeldMemberships } from "@/lib/membership-held";

/** GET → { held: HeldMembership | null } — a paid-in-advance membership still
 *  waiting to be switched on (used by the POS banner). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const held = (await loadHeldMemberships([id])).get(id) ?? null;
  return NextResponse.json({ held });
}
