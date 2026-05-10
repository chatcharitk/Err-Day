import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/liff/link
// Links a LINE account to an existing customer record by phone number.
// Called from the /liff/link page after the user enters their phone.
export async function POST(request: Request) {
  const { lineUserId, phone, displayName, pictureUrl } = await request.json();

  if (!lineUserId || !phone) {
    return NextResponse.json({ error: "lineUserId and phone are required" }, { status: 400 });
  }

  // Normalise phone: accept 0XXXXXXXXX or +66XXXXXXXXX
  const normalised = phone.trim().replace(/\s/g, "").replace(/^\+66/, "0");

  // Check if this LINE account is already linked to someone
  const alreadyLinked = await prisma.customer.findUnique({ where: { lineUserId } });
  if (alreadyLinked) {
    return NextResponse.json({
      ok:   true,
      already: true,
      name: alreadyLinked.nickname || alreadyLinked.name,
    });
  }

  // Find the customer by phone
  const customer = await prisma.customer.findUnique({ where: { phone: normalised } });
  if (!customer) {
    return NextResponse.json({ error: "ไม่พบเบอร์โทรนี้ในระบบ กรุณาติดต่อพนักงาน" }, { status: 404 });
  }

  // Link the LINE account
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      lineUserId,
      ...(pictureUrl ? { pictureUrl } : {}),
      // Sync display name only if the stored name is a placeholder
      ...(displayName && customer.name === "Walk-in" ? { name: displayName } : {}),
    },
  });

  return NextResponse.json({
    ok:   true,
    already: false,
    name: customer.nickname || customer.name,
  });
}
