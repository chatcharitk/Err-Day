import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getCurrentStaff } from "@/lib/staff-auth";
import { notifyAdmins } from "@/lib/notify-admin";
import { STAFF_LINE_IDS } from "@/lib/notifications";
import { multicastText } from "@/lib/line-messaging";
import { RESTOCK_GROUPS, isRestockItem } from "@/lib/restock";
import { shortBranchName } from "@/lib/stock";

/**
 * POST  { branchId, items: (string | { item, note })[], extras?: string[], note? } — staff (or admin)
 *       sends the branch's restock checklist; every admin gets a push and the
 *       owners (Looklipair + Chatcharit) a LINE message.
 * PATCH { id, done: boolean } — admin marks a request brought / reopens it.
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  const staff = admin ? null : await getCurrentStaff();
  if (!admin && !staff) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => null) as { branchId?: unknown; items?: unknown; extras?: unknown; note?: unknown } | null;
  const branch = typeof b?.branchId === "string"
    ? await prisma.branch.findFirst({ where: { id: b.branchId, isActive: true }, select: { id: true, name: true } })
    : null;
  if (!branch) return NextResponse.json({ error: "กรุณาเลือกสาขา" }, { status: 400 });

  // Each ticked item may carry a quantity note; stored as "แชมพู · 2 ขวด".
  const picked = new Map<string, string>();
  for (const x of Array.isArray(b?.items) ? b.items : []) {
    const item = typeof x === "string" ? x : typeof x?.item === "string" ? x.item : "";
    const n = typeof x === "object" && typeof x?.note === "string" ? x.note.trim().slice(0, 60) : "";
    if (isRestockItem(item)) picked.set(item, n);
  }
  const items = RESTOCK_GROUPS.flatMap(g => g.items).filter(i => picked.has(i)) // checklist order
    .map(i => (picked.get(i) ? `${i} · ${picked.get(i)}` : i));
  const extras = (Array.isArray(b?.extras) ? b.extras : [])
    .filter((x): x is string => typeof x === "string").map(x => x.trim().slice(0, 100)).filter(Boolean).slice(0, 10);
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 500) || null : null;
  if (!items.length && !extras.length) return NextResponse.json({ error: "ยังไม่ได้เลือกของ" }, { status: 400 });

  const requestedBy = admin?.name ?? staff!.name;
  const r = await prisma.restockRequest.create({
    data: { branchId: branch.id, items, extras, note, requestedBy, staffId: staff?.id ?? null },
  });

  const all = [...items, ...extras];
  const title = `🧺 ของที่ต้องเติม · ${shortBranchName(branch.name)} (${all.length})`;
  await Promise.all([
    notifyAdmins({
      type: "RESTOCK",
      title,
      body: `${all.join(", ")}${note ? `\nหมายเหตุ: ${note}` : ""}\n— ${requestedBy}`,
      href: "/admin/m/restock",
      branchId: branch.id,
    }),
    multicastText(STAFF_LINE_IDS, `${title}\n\n${all.map(i => `• ${i}`).join("\n")}${note ? `\n\nหมายเหตุ: ${note}` : ""}\n\n— ${requestedBy}`)
      .catch(e => console.error("[restock] LINE failed", e)),
  ]);
  return NextResponse.json({ ok: true, id: r.id });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => null) as { id?: unknown; done?: unknown } | null;
  if (typeof b?.id !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const done = b.done !== false;
  await prisma.restockRequest.update({
    where: { id: b.id },
    data: done ? { status: "DONE", doneAt: new Date(), doneBy: admin.name } : { status: "OPEN", doneAt: null, doneBy: null },
  });
  return NextResponse.json({ ok: true });
}
