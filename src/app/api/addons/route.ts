import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public booking options: active add-ons and their current prices. */
export async function GET() {
  const addons = await prisma.serviceAddon.findMany({
    where: { isActive: true },
    select: { id: true, name: true, nameTh: true, price: true },
    orderBy: { nameTh: "asc" },
  });

  return NextResponse.json(addons);
}
