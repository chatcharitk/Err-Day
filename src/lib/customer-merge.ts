import { prisma } from "@/lib/prisma";

/**
 * Merge a duplicate customer (`removeId`) into the one to keep (`keepId`), e.g.
 * the LINE sign-up "Mintaree" into the in-shop record "มินตะร์" with all the
 * bookings. Everything moves to the kept record in one transaction; the
 * duplicate is then deleted.
 *
 * Rules: the kept record's own values win; its empty fields are filled from the
 * duplicate (LINE link, nickname, birthday, PDPA consent, photo…). The
 * duplicate's phone is kept in the notes. Memberships: the active/paid one
 * stays, an unpaid pending sign-up is dropped. Coupons of the same campaign:
 * the used one (else the kept record's) stays.
 */
export async function mergeCustomers(keepId: string, removeId: string, actorName: string) {
  if (keepId === removeId) throw new MergeError("เลือกบัญชีเดียวกัน");
  return prisma.$transaction(async tx => {
    const [keep, drop] = await Promise.all([
      tx.customer.findUnique({ where: { id: keepId }, include: { membership: { include: { cycles: true } }, hairProfile: true } }),
      tx.customer.findUnique({ where: { id: removeId }, include: { membership: { include: { cycles: true } }, hairProfile: true } }),
    ]);
    if (!keep || !drop) throw new MergeError("ไม่พบลูกค้า");

    // ── Membership ──────────────────────────────────────────────────────────
    const isReal = (m: NonNullable<typeof keep.membership>) => !m.pendingActivation || m.cycles.some(c => c.paidAmount > 0);
    if (drop.membership) {
      if (!keep.membership) {
        await tx.membership.update({ where: { id: drop.membership.id }, data: { customerId: keepId } });
      } else if (!isReal(keep.membership) && isReal(drop.membership)) {
        // Kept record only has an unpaid sign-up — the duplicate's real membership replaces it.
        await tx.membershipCycle.deleteMany({ where: { membershipId: keep.membership.id } });
        await tx.membership.delete({ where: { id: keep.membership.id } });
        await tx.membership.update({ where: { id: drop.membership.id }, data: { customerId: keepId } });
      } else {
        // Keep the kept record's membership; any paid periods of the duplicate move onto it.
        await tx.membershipCycle.updateMany({ where: { membershipId: drop.membership.id }, data: { membershipId: keep.membership.id } });
        await tx.membership.delete({ where: { id: drop.membership.id } });
      }
    }
    await tx.membershipCycle.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } });

    // ── Coupons (one per campaign per customer) ─────────────────────────────
    const [kc, dc] = await Promise.all([
      tx.coupon.findMany({ where: { customerId: keepId } }),
      tx.coupon.findMany({ where: { customerId: removeId } }),
    ]);
    for (const c of dc) {
      const clash = kc.find(k => k.campaignId === c.campaignId);
      if (!clash) { await tx.coupon.update({ where: { id: c.id }, data: { customerId: keepId } }); continue; }
      if (c.usesUsed > clash.usesUsed) {
        await tx.coupon.delete({ where: { id: clash.id } });
        await tx.coupon.update({ where: { id: c.id }, data: { customerId: keepId } });
      } else {
        await tx.coupon.delete({ where: { id: c.id } });
      }
    }

    // ── Hair-colour profile (one per customer) ──────────────────────────────
    if (drop.hairProfile) {
      if (!keep.hairProfile) await tx.hairProfile.update({ where: { id: drop.hairProfile.id }, data: { customerId: keepId } });
      else await tx.hairProfile.delete({ where: { id: drop.hairProfile.id } });
    }

    // ── Everything else simply moves ─────────────────────────────────────────
    const moved = {
      bookings: (await tx.booking.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
      packages: (await tx.customerPackage.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
      inbox: (await tx.inboxThread.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
      votes: (await tx.staffVote.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
      colorVisits: (await tx.colorVisit.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
      receipts: (await tx.receipt.updateMany({ where: { customerId: removeId }, data: { customerId: keepId } })).count,
    };

    // ── Profile fields: fill the kept record's gaps from the duplicate ─────────
    const photos = [...new Set([...(JSON.parse(keep.photoUrls ?? "[]") as string[]), ...(JSON.parse(drop.photoUrls ?? "[]") as string[])])];
    const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const noteLines = [
      keep.notes?.trim(),
      drop.notes?.trim(),
      `[รวมบัญชี ${day} โดย ${actorName}] จาก “${drop.name}”${drop.nickname ? ` (${drop.nickname})` : ""} · เบอร์ ${drop.phone}`,
    ].filter(Boolean);
    const lineUserId = keep.lineUserId ?? drop.lineUserId;
    await tx.customer.update({ where: { id: removeId }, data: { lineUserId: null } }); // free the unique LINE id first
    await tx.customer.update({
      where: { id: keepId },
      data: {
        lineUserId,
        lineDisplayName: keep.lineDisplayName ?? drop.lineDisplayName,
        pictureUrl: keep.pictureUrl ?? drop.pictureUrl,
        nickname: keep.nickname ?? drop.nickname,
        email: keep.email ?? drop.email,
        gender: keep.gender ?? drop.gender,
        dateOfBirth: keep.dateOfBirth ?? drop.dateOfBirth,
        pdpaConsentAt: keep.pdpaConsentAt ?? drop.pdpaConsentAt,
        pdpaSource: keep.pdpaConsentAt ? keep.pdpaSource : drop.pdpaSource,
        pdpaVersion: keep.pdpaConsentAt ? keep.pdpaVersion : drop.pdpaVersion,
        photoUrls: photos.length ? JSON.stringify(photos) : keep.photoUrls,
        notes: noteLines.join("\n"),
      },
    });
    await tx.customer.delete({ where: { id: removeId } });
    return { keepId, moved, linkedLine: !keep.lineUserId && !!drop.lineUserId };
  }, { timeout: 30_000 });
}

export class MergeError extends Error {}
