/**
 * Bulk shift operations for a branch. Lets the admin UI do "copy last week",
 * "apply default to all", "clear week", etc. in a single round-trip instead
 * of one HTTP call per shift.
 *
 * POST /api/admin/branches/[id]/shifts/bulk
 *   body: {
 *     create?: Array<{ staffId: string; date: "YYYY-MM-DD"; startTime: "HH:mm"; endTime: "HH:mm" }>,
 *     delete?: string[]  // shift IDs
 *   }
 *
 * - All ops run inside a single transaction
 * - `create` uses createMany with skipDuplicates so re-applying a template
 *   doesn't error on the (staffId, date, startTime) unique constraint
 * - `delete` only removes shifts that belong to staff in the requested branch
 *   (defensive — admin UI never sends mismatched IDs, but a malicious client
 *   could)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CreateInput {
  staffId:   string;
  date:      string;   // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
  endTime:   string;
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_TIME = /^\d{2}:\d{2}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: branchId } = await params;
  const body = await request.json().catch(() => ({}));
  const create: CreateInput[] = Array.isArray(body.create) ? body.create : [];
  const del:    string[]      = Array.isArray(body.delete) ? body.delete : [];

  // Validate creates
  for (const c of create) {
    if (!c.staffId || typeof c.staffId !== "string") {
      return NextResponse.json({ error: "Each create needs a staffId" }, { status: 400 });
    }
    if (!RE_DATE.test(c.date) || !RE_TIME.test(c.startTime) || !RE_TIME.test(c.endTime)) {
      return NextResponse.json({ error: "Invalid date/time format (expect YYYY-MM-DD and HH:mm)" }, { status: 400 });
    }
    if (c.endTime <= c.startTime) {
      return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
    }
  }

  // Defensive: confirm all referenced staff belong to this branch
  const staffIds = Array.from(new Set([
    ...create.map(c => c.staffId),
  ]));
  if (staffIds.length > 0) {
    const branchStaffCount = await prisma.staff.count({
      where: { branchId, id: { in: staffIds } },
    });
    if (branchStaffCount !== staffIds.length) {
      return NextResponse.json({ error: "Some staffIds don't belong to this branch" }, { status: 400 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let deleted = 0;
    if (del.length > 0) {
      // Only delete shifts whose staff belongs to this branch
      const r = await tx.staffShift.deleteMany({
        where: {
          id:    { in: del },
          staff: { branchId },
        },
      });
      deleted = r.count;
    }

    let created = 0;
    if (create.length > 0) {
      const r = await tx.staffShift.createMany({
        data: create.map(c => ({
          staffId:   c.staffId,
          // Store at noon UTC of the local calendar day — matches what the
          // shifts API / capacity library reads.
          date:      new Date(c.date + "T12:00:00Z"),
          startTime: c.startTime,
          endTime:   c.endTime,
        })),
        skipDuplicates: true,
      });
      created = r.count;
    }

    return { deleted, created };
  });

  return NextResponse.json({ ok: true, ...result });
}
