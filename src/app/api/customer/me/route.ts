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
    select: { id: true, name: true, phone: true, email: true },
  });

  return NextResponse.json(customer ?? null);
}
