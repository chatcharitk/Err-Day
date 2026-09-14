import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  computeBranchDailyPayout,
  bangkokDayNoon,
  bangkokTodayStr,
  payrollExpenseMarker,
  type PayrollCalculation,
} from "@/lib/payroll";
import { numberIn, validDay, workMinutes } from "@/lib/finance-math";
import { jsonSnapshot } from "@/lib/finance-audit";

export async function GET(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  const sp = new URL(request.url).searchParams;
  const branch = sp.get("branchId"),
    day = sp.get("date") || bangkokTodayStr();
  if (!branch || !validDay(day))
    return NextResponse.json(
      { error: "สาขาหรือวันที่ไม่ถูกต้อง" },
      { status: 400 },
    );
  return NextResponse.json({
    rows: await computeBranchDailyPayout(branch, day),
  });
}
export async function PATCH(request: Request) {
  const gate = await requireOwner().catch((e: unknown) => e as Response);
  if (gate instanceof Response) return gate;
  try {
    const body = await request.json();
    const { staffId, date, sourceToken, action } = body;
    if (
      typeof staffId !== "string" ||
      !validDay(date ?? "") ||
      !["save", "settle", "reopen"].includes(action)
    )
      throw new Error("ข้อมูลการบันทึกไม่ถูกต้อง กรุณาโหลดหน้าใหม่");
    if (date > bangkokTodayStr())
      throw new Error("ยังยืนยันการทำงานหรือจ่ายเงินในอนาคตไม่ได้");
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${staffId}:${date}`}))::text`;
        const staff = await tx.staff.findUniqueOrThrow({
          where: { id: staffId },
        });
        const noon = bangkokDayNoon(date);
        const where = { staffId_date: { staffId, date: noon } };
        const existing = await tx.staffDailyPayout.findUnique({ where });
        const branchId = existing?.branchId ?? staff.branchId;
        const before = (
          await computeBranchDailyPayout(branchId, date, tx)
        ).find((r) => r.staffId === staffId);
        if (!before) throw new Error("ไม่พบพนักงานในวันนี้");
        // A retried settlement may succeed even with an old preview, but can never create another expense.
        if (
          action === "settle" &&
          existing?.status === "PAID" &&
          existing.expenseId
        ) {
          const linked = await tx.expense.findUnique({
            where: { id: existing.expenseId },
          });
          if (linked?.status === "VOIDED")
            throw new Error(
              "รายจ่ายเดิมถูกยกเลิกแล้ว กรุณาเปิดแก้ค่าตอบแทนพร้อมเหตุผล",
            );
          if (linked)
            return { alreadyRecorded: true, expenseId: existing.expenseId };
        }
        if (sourceToken !== before.sourceToken) return { conflict: true };
        const monthly = await tx.expense.findFirst({
          where: {
            branchId,
            status: { not: "VOIDED" },
            notes: {
              contains: payrollExpenseMarker(staffId, date.slice(0, 7)),
            },
          },
        });
        if (monthly && action !== "save")
          throw new Error(
            "เดือนนี้มีรายจ่ายสรุปแบบเดิม ต้องให้บัญชีกระทบยอดและยกเลิกรายการเดือนที่ซ้ำก่อน",
          );
        if (action === "reopen") {
          const reason = String(body.reason ?? "").trim();
          if (!reason || existing?.status !== "PAID")
            throw new Error("กรุณาระบุเหตุผลเปิดแก้รายการที่จ่ายแล้ว");
          if (existing.expenseId) {
            const oldExpense = await tx.expense.findUnique({
              where: { id: existing.expenseId },
            });
            if (oldExpense) {
              await tx.expense.update({
                where: { id: existing.expenseId },
                data: { status: "VOIDED" },
              });
              await tx.financeAudit.create({
                data: {
                  entity: "EXPENSE",
                  recordId: oldExpense.id,
                  action: "VOID",
                  actor: gate.username,
                  before: jsonSnapshot(oldExpense),
                  after: jsonSnapshot({ status: "VOIDED", reason }),
                },
              });
            }
          }
          const after = await tx.staffDailyPayout.update({
            where,
            data: {
              status: "PENDING",
              expenseId: null,
              commissionSatang: null,
              otSatang: null,
              calculation: undefined,
              paidAt: null,
              paidBy: null,
              revision: { increment: 1 },
            },
          });
          await tx.financeAudit.create({
            data: {
              entity: "PAYROLL",
              recordId: after.id,
              action: "REOPEN",
              actor: gate.username,
              before: jsonSnapshot(before),
              after: jsonSnapshot({ ...after, reason }),
            },
          });
          return { ok: true };
        }
        if (existing?.status === "PAID") {
          if (action === "save")
            throw new Error("รายการจ่ายแล้ว ต้องเปิดแก้พร้อมเหตุผลก่อน");
          // Historical paid-but-unrecorded payouts are recorded at their saved amounts below.
        } else {
          const otMode = body.otMode;
          if (otMode !== "AUTO" && otMode !== "MANUAL")
            throw new Error("กรุณาเลือกวิธีคิด OT");
          const tipSatang = numberIn(body.tipSatang, "ทิป", 0, 5_000_000);
          const commissionSatang =
            body.commissionSatang == null
              ? null
              : numberIn(body.commissionSatang, "ค่าคอมรวม", 0, 50_000_000);
          const adjustmentSatang = numberIn(
            body.adjustmentSatang,
            "ปรับเพิ่ม/ลด",
            -5_000_000,
            5_000_000,
          );
          const adjustmentReason = String(body.adjustmentReason ?? "").trim();
          if (
            (adjustmentSatang !== 0 ||
              otMode === "MANUAL" ||
              commissionSatang != null) &&
            !adjustmentReason
          )
            throw new Error("กรุณาระบุเหตุผลแก้ค่าคอม / OT / ปรับยอด");
          const otHours =
            otMode === "MANUAL"
              ? numberIn(body.otHours, "ชั่วโมง OT", 0, 24, false)
              : 0;
          if (body.clockIn || body.clockOut) {
            const clockIn = new Date(body.clockIn),
              clockOut = new Date(body.clockOut);
            const breaks = numberIn(body.breakMinutes, "เวลาพัก", 0, 1440);
            workMinutes(clockIn, clockOut, breaks);
            if (
              new Date(clockIn.getTime() + 7 * 3600000)
                .toISOString()
                .slice(0, 10) !== date
            )
              throw new Error("วันเข้างานต้องตรงกับวันที่เลือก");
            if (clockOut.getTime() > Date.now())
              throw new Error("เวลาออกงานจริงยังมาไม่ถึง");
            const old = await tx.staffAttendance.findUnique({ where });
            const notes = String(body.attendanceNotes ?? "").trim();
            if (
              old &&
              (old.clockIn.getTime() !== clockIn.getTime() ||
                old.clockOut.getTime() !== clockOut.getTime() ||
                old.breakMinutes !== breaks) &&
              !notes
            )
              throw new Error("กรุณาระบุเหตุผลแก้เวลาเข้า–ออก");
            const att = await tx.staffAttendance.upsert({
              where,
              create: {
                staffId,
                date: noon,
                clockIn,
                clockOut,
                breakMinutes: breaks,
                notes,
                confirmedBy: gate.username,
              },
              update: {
                clockIn,
                clockOut,
                breakMinutes: breaks,
                notes,
                confirmedBy: gate.username,
              },
            });
            await tx.financeAudit.create({
              data: {
                entity: "ATTENDANCE",
                recordId: att.id,
                action: old ? "UPDATE" : "CONFIRM",
                actor: gate.username,
                ...(old ? { before: jsonSnapshot(old) } : {}),
                after: jsonSnapshot(att),
              },
            });
          }
          await tx.staffDailyPayout.upsert({
            where,
            create: {
              staffId,
              branchId,
              date: noon,
              otMode,
              otHours,
              commissionSatang,
              tipSatang,
              adjustmentSatang,
              adjustmentReason,
            },
            update: {
              otMode,
              otHours,
              commissionSatang,
              tipSatang,
              adjustmentSatang,
              adjustmentReason,
              revision: { increment: 1 },
            },
          });
        }
        const current = (
          await computeBranchDailyPayout(branchId, date, tx)
        ).find((r) => r.staffId === staffId)!;
        let expenseId: string | null = null;
        if (action === "settle") {
          if (current.otMode === "AUTO" && current.workedMinutes == null)
            throw new Error("ต้องยืนยันเวลาเข้า–ออกจริงก่อนคำนวณ OT อัตโนมัติ");
          if (
            current.otHours > 0 &&
            current.otRateSatang <= 0 &&
            existing?.status !== "PAID"
          )
            throw new Error("กรุณาตั้งค่าเรต OT ก่อนจ่าย");
          numberIn(current.totalSatang, "ยอดจ่ายสุทธิ");
          if (
            !["CASH", "TRANSFER", "CARD", "OTHER"].includes(body.paymentMethod)
          )
            throw new Error("กรุณาระบุวิธีจ่าย");
          const payee = await tx.vendor.upsert({
            where: { staffId },
            create: { staffId, name: staff.name, type: "EMPLOYEE" },
            update: {},
          });
          const calc: PayrollCalculation = {
            bookings: current.bookings,
            normalWorkMinutes: current.normalWorkMinutes,
            workedMinutes: current.workedMinutes,
            clockIn: current.clockIn,
            clockOut: current.clockOut,
            breakMinutes: current.breakMinutes,
            attendanceNotes: current.attendanceNotes,
            otMode: current.otMode,
            otHours: current.otHours,
            otRateSatang: current.otRateSatang,
            otSatang: current.otSatang,
            commissionSatang: current.commissionSatang,
            tipSatang: current.tipSatang,
            adjustmentSatang: current.adjustmentSatang,
            adjustmentReason: current.adjustmentReason,
            totalSatang: current.totalSatang,
          };
          const components = [
            ["COMMISSION", "ค่าคอมมิชชั่น", calc.commissionSatang],
            ["OT", "ค่า OT", calc.otSatang],
            ["TIP", "ทิป", calc.tipSatang],
            [
              "ADJUSTMENT",
              "ปรับเพิ่ม/ลด: " + calc.adjustmentReason,
              calc.adjustmentSatang,
            ],
          ] as const;
          const expense = await tx.expense.create({
            data: {
              sourceKey: `PAYROLL:${staffId}:${date}:${current.revision}`,
              branchId,
              vendorId: payee.id,
              vendor: payee.legalName || payee.name,
              payeeSnapshot: jsonSnapshot(payee),
              category: "commission_bonus",
              date: noon,
              documentDate: noon,
              paidAt:
                existing?.status === "PAID" ? existing.paidAt : new Date(),
              paymentMethod: body.paymentMethod,
              totalAmount: calc.totalSatang,
              vatMode: "NONE",
              vatAmount: 0,
              notes: `ค่าตอบแทน ${date} · ${staff.name}`,
              status: "CONFIRMED",
              items: {
                create: components
                  .filter((c) => c[2] !== 0)
                  .map(([kind, description, amount]) => ({
                    kind,
                    description,
                    quantity: 1,
                    unitPrice: amount,
                    totalPrice: amount,
                  })),
              },
            },
          });
          expenseId = expense.id;
          await tx.financeAudit.create({
            data: {
              entity: "EXPENSE",
              recordId: expense.id,
              action: "CREATE",
              actor: gate.username,
              after: jsonSnapshot(expense),
            },
          });
          await tx.staffDailyPayout.update({
            where,
            data: {
              status: "PAID",
              otHours: calc.otHours,
              commissionSatang: calc.commissionSatang,
              otSatang: calc.otSatang,
              calculation:
                existing?.status === "PAID" && !existing.calculation
                  ? undefined
                  : jsonSnapshot(calc),
              worked: (calc.workedMinutes ?? 0) > 0,
              paidAt:
                existing?.status === "PAID" ? existing.paidAt : new Date(),
              paidBy:
                existing?.status === "PAID" ? existing.paidBy : gate.username,
              expenseId,
            },
          });
        }
        const after = await tx.staffDailyPayout.findUniqueOrThrow({ where });
        await tx.financeAudit.create({
          data: {
            entity: "PAYROLL",
            recordId: after.id,
            action: action.toUpperCase(),
            actor: gate.username,
            before: jsonSnapshot(before),
            after: jsonSnapshot(after),
          },
        });
        return { ok: true, expenseId };
      },
      { isolationLevel: "Serializable", timeout: 20000 },
    );
    return NextResponse.json(
      result.conflict
        ? {
            error:
              "ข้อมูลเปลี่ยนระหว่างตรวจ กรุณาโหลดข้อมูลล่าสุดแล้วตรวจยอดอีกครั้ง",
          }
        : result,
      { status: result.conflict ? 409 : 200 },
    );
  } catch (e) {
    const conflict =
      e &&
      typeof e === "object" &&
      "code" in e &&
      ["P2034", "P2002"].includes(String(e.code));
    return NextResponse.json(
      {
        error: conflict
          ? "มีการบันทึกพร้อมกัน กรุณาโหลดข้อมูลล่าสุด"
          : e instanceof Error
            ? e.message
            : "บันทึกไม่สำเร็จ",
      },
      { status: conflict ? 409 : 400 },
    );
  }
}
