/**
 * Vendor find-or-create — server-only (imports the Prisma client), used by
 * the expense create/update routes.
 *
 * The expense form is a single free-text field, not a forced "pick or add"
 * dropdown — typing any name and saving still builds the reusable registry:
 * an exact (case-insensitive, trimmed) name match reuses the existing Vendor,
 * anything new creates one. This is what makes "search and reuse" work
 * without adding a step to the common case of just typing a name.
 */
import { prisma } from "@/lib/prisma";

/** Resolve a typed vendor name to a Vendor id, creating one if it's new. Returns null for blank input. */
export async function findOrCreateVendorId(name: string | null | undefined, defaultCategory?: string | null): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await prisma.vendor.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.vendor.create({
    data: { name: trimmed, category: defaultCategory || null },
  });
  return created.id;
}
