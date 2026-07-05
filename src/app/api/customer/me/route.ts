import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/customer/me?lineUserId=xxx
 * Returns the customer record matching the given LINE user ID.
 * Used to pre-fill the booking form for returning customers.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineUserId = searchParams.get("lineUserId")?.trim();

  if (!lineUserId) {
    return NextResponse.json(null);
  }

  const customer = await prisma.customer.findUnique({
    where: { lineUserId },
    // nickname + dateOfBirth included so the booking form pre-fills them for
    // returning customers (nickname was expected by the form but missing here).
    select: { id: true, name: true, nickname: true, phone: true, email: true, dateOfBirth: true },
  });

  return NextResponse.json(customer ?? null);
}
