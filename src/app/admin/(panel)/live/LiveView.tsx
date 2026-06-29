"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Users, ExternalLink } from "lucide-react";
import type { DeskBoardData, DeskBooking, StaffLoad } from "@/lib/desk";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";

export interface LiveBoard extends DeskBoardData { branchName: string }

export default function LiveView({
  branches, activeBranchId, initialBoards, basePath = "/admin/live",
}: {
  branches: { id: string; name: string }[];
  activeBranchId: string;
  initialBoards: LiveBoard[];
  /** Route prefix for branch-switch links — "/admin/live" (desktop) or "/admin/m/live" (mobile). */
  basePath?: string;
}) {
  const router = useRouter();
  const [boards, setBoards]   = useState<LiveBoard[]>(initialBoards);
  const [syncing, setSyncing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());

  // Reset to the freshly SSR'd boards when the branch filter changes. Adjusting
  // state during render (vs. in an effect) is the React-recommended way to
  // derive state from changing props — no extra paint, no cascading render.
  const [prevInit, setPrevInit] = useState(initialBoards);
  if (initialBoards !== prevInit) {
    setPrevInit(initialBoards);
    setBoards(initialBoards);
    // updatedAt refreshes on the next poll tick (≤15s); the SSR data is current.
  }

  const refresh = useCallback(async () => {
    try {
      setSyncing(true);
      const qs = activeBranchId === "all" ? "" : `?branchId=${encodeURIComponent(activeBranchId)}`;
      const res = await fetch(`/api/admin/live${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setBoards(data.boards);
      setUpdatedAt(Date.now());
    } catch { /* keep last good */ }
    finally { setSyncing(false); }
  }, [activeBranchId]);

  // Poll every 20s to mirror the in-store devices — paused while the tab is
  // hidden, and refreshed immediately when it becomes visible again.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 20_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  function selectBranch(id: string) {
    const params = new URLSearchParams();
    if (id !== "all") params.set("branchId", id);
    router.push(`${basePath}${params.toString() ? `?${params}` : ""}`);
  }

  const options = [{ id: "all", label: "ทุกสาขา" }, ...branches.map(b => ({ id: b.id, label: b.name.replace(/^err\.day\s*/i, "") }))];
  const updatedStr = new Date(updatedAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: MUTED }}>Real-time</p>
          <h1 className="text-2xl font-medium" style={{ color: TEXT }}>หน้าร้านสด — ลูกค้าต่อช่างวันนี้</h1>
          <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: MUTED }}>
            <RefreshCw size={11} className={syncing ? "animate-spin" : ""} /> อัปเดตล่าสุด {updatedStr} · รีเฟรชอัตโนมัติทุก 15 วินาที
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/desk" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full"
            style={{ border: `1.5px solid ${BORDER}`, color: TEXT }}>
            <ExternalLink size={13} /> เปิดจอหน้าร้าน
          </a>
          <div className="flex flex-wrap gap-1.5 bg-white rounded-full p-1" style={{ border: `1.5px solid ${BORDER}` }}>
            {options.map(o => {
              const active = o.id === activeBranchId;
              return (
                <button key={o.id} onClick={() => selectBranch(o.id)}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
                  style={{ background: active ? PRIMARY : "transparent", color: active ? "white" : TEXT }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {boards.map(board => (
          <BranchPanel key={board.branchId} board={board} showName={boards.length > 1} />
        ))}
      </div>
    </div>
  );
}

function BranchPanel({ board, showName }: { board: LiveBoard; showName: boolean }) {
  const inService = board.bookings.filter(b => b.deskStatus === "IN_SERVICE");
  const waiting   = board.bookings.filter(b => b.deskStatus === "WAITING");

  // Customers who arrived / were served today but have NO assigned stylist —
  // they aren't in any staff card, so surface them on their own.
  const arrivedNoStaff = board.bookings.filter(
    b => !b.staffId && (b.checkedInAt != null || b.deskStatus === "DONE"),
  );
  const unassigned = {
    taken:     arrivedNoStaff.length,
    inService: arrivedNoStaff.filter(b => b.deskStatus !== "DONE").length,
    done:      arrivedNoStaff.filter(b => b.deskStatus === "DONE").length,
  };

  const assignedTaken = board.load.reduce((s, l) => s + l.taken, 0);
  const totalTaken = assignedTaken + unassigned.taken;
  const sortedLoad = [...board.load].sort((a, b) => b.taken - a.taken || b.inService - a.inService);
  const fewest = sortedLoad.length ? Math.min(...sortedLoad.map(l => l.taken)) : 0;

  return (
    <section>
      {showName && (
        <h2 className="text-lg font-semibold mb-3" style={{ color: TEXT }}>{board.branchName}</h2>
      )}

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-4">
        <SummaryChip label="ลูกค้าวันนี้" value={totalTaken} />
        <SummaryChip label="กำลังบริการ" value={inService.length} accent />
        <SummaryChip label="รอเช็คอิน" value={waiting.length} />
      </div>

      {/* Per-staff load cards (+ a card for customers with no assigned stylist) */}
      {sortedLoad.length === 0 && unassigned.taken === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>ยังไม่มีพนักงานในสาขานี้</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedLoad.map(s => (
            <StaffCard key={s.staffId} s={s} lightest={s.taken === fewest && assignedTaken > 0} />
          ))}
          {unassigned.taken > 0 && <UnassignedCard u={unassigned} />}
        </div>
      )}

      {/* In-service context list */}
      {inService.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${BORDER}` }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: MUTED }}>กำลังบริการอยู่</p>
          <ul className="space-y-1.5">
            {inService.map(b => <InServiceRow key={b.id} b={b} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

function SummaryChip({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white px-5 py-3" style={{ border: `1.5px solid ${accent ? PRIMARY : BORDER}` }}>
      <p className="text-xs" style={{ color: MUTED }}>{label}</p>
      <p className="text-2xl font-bold leading-tight" style={{ color: accent ? PRIMARY : TEXT }}>{value}</p>
    </div>
  );
}

function StaffCard({ s, lightest }: { s: StaffLoad; lightest: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4" style={{ border: `1.5px solid ${s.inService > 0 ? PRIMARY : BORDER}` }}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{s.name}</p>
        {lightest && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#ECFDF5", color: "#047857" }}>
            ว่างสุด
          </span>
        )}
      </div>
      <p className="text-4xl font-extrabold leading-tight mt-1" style={{ color: s.taken > 0 ? PRIMARY : MUTED }}>{s.taken}</p>
      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: MUTED }}>
        <Users size={11} /> กำลังทำ {s.inService} · เสร็จ {s.done}
      </p>
    </div>
  );
}

function UnassignedCard({ u }: { u: { taken: number; inService: number; done: number } }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: "1.5px dashed #C2410C", background: "#FFF7ED" }}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm font-semibold truncate" style={{ color: "#9A3412" }}>ไม่ระบุช่าง</p>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "#FFEDD5", color: "#9A3412" }}>
          ต้องจัดช่าง
        </span>
      </div>
      <p className="text-4xl font-extrabold leading-tight mt-1" style={{ color: "#C2410C" }}>{u.taken}</p>
      <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: MUTED }}>
        <Users size={11} /> กำลังทำ {u.inService} · เสร็จ {u.done}
      </p>
    </div>
  );
}

function InServiceRow({ b }: { b: DeskBooking }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate" style={{ color: TEXT }}>
        <span className="font-semibold">{b.staffName ?? "—"}</span>
        <span style={{ color: MUTED }}> · {b.customerName}</span>
      </span>
      <span className="text-xs flex-shrink-0" style={{ color: MUTED }}>{b.serviceName}</span>
    </li>
  );
}
