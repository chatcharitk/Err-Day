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
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { timeToMins } from "@/lib/capacity";

interface CreateInput {
  staffId:   string;
  date:      string;   // "YYYY-MM-DD"
  startTime: string;   // "HH:mm"
  endTime:   string;
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_TIME = /^\d{2}:\d{2}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const _gate = await requireAdmin().catch((e: unknown) => e as Response);
  if (_gate instanceof Response) return _gate;

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
      // Drop overlapping entries for the same staff/day (keep the first) so a bad
      // template can't insert two overlapping shifts for one person — which would
      // make them cover extra slots and inflate capacity.
      const deduped: CreateInput[] = [];
      for (const c of create) {
        const clash = deduped.some(k =>
          k.staffId === c.staffId && k.date === c.date &&
          timeToMins(k.startTime) < timeToMins(c.endTime) && timeToMins(k.endTime) > timeToMins(c.startTime),
        );
        if (!clash) deduped.push(c);
      }

      // Replace any EXISTING shift that overlaps a create (same staff/day) so a
      // create can never stack a second overlapping row — the server guarantee
      // that mirrors the single-shift POST. (Covers stale-client / older-build
      // cases where the client didn't send the existing shift in `delete`.)
      const createStaff = [...new Set(deduped.map(c => c.staffId))];
      const sortedDates = deduped.map(c => c.date).sort();
      if (createStaff.length > 0) {
        const spanStart = new Date(sortedDates[0] + "T00:00:00Z");
        const spanEnd   = new Date(sortedDates[sortedDates.length - 1] + "T23:59:59Z");
        const existing = await tx.staffShift.findMany({
          where:  { staffId: { in: createStaff }, date: { gte: spanStart, lte: spanEnd } },
          select: { id: true, staffId: true, date: true, startTime: true, endTime: true },
        });
        const overlapIds = existing.filter(e => {
          const eDay = e.date.toISOString().slice(0, 10);
          return deduped.some(c =>
            c.staffId === e.staffId && c.date === eDay &&
            timeToMins(e.startTime) < timeToMins(c.endTime) && timeToMins(e.endTime) > timeToMins(c.startTime),
          );
        }).map(e => e.id);
        if (overlapIds.length > 0) {
          await tx.staffShift.deleteMany({ where: { id: { in: overlapIds } } });
        }
      }

      const r = await tx.staffShift.createMany({
        data: deduped.map(c => ({
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
