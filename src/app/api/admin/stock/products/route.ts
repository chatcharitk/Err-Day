import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseProductInput } from "@/lib/stock-products";

/** POST /api/admin/stock/products — add a product. */
export async function POST(request: Request) {
  const gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const b = await request.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parseProductInput(b ?? {}, false);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const product = await prisma.product.create({ data: parsed.data as Parameters<typeof prisma.product.create>[0]["data"] });
    return NextResponse.json({ product });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return NextResponse.json({ error: "สินค้าขายนี้ผูกกับสินค้าอื่นแล้ว" }, { status: 409 });
    throw e;
  }
}
