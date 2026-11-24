import { NextResponse } from "next/server";
import { getKioskBranch } from "@/lib/kiosk-auth";
import { branchPunchesToday, mintClockQr } from "@/lib/clock";

export const dynamic = "force-dynamic";

/** GET → the desk's current clock-in QR (changes every minute) + today's scans. */
export async function GET() {
  const branch = await getKioskBranch();
  if (!branch) return NextResponse.json({ error: "Kiosk not armed" }, { status: 401 });
  const qr = mintClockQr(branch.id);
  const punches = await branchPunchesToday(branch.id);
  return NextResponse.json({ ...qr, serverNow: Date.now(), punches }, { headers: { "Cache-Control": "no-store" } });
}
