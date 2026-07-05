"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, RefreshCw, Settings, Check, Clock, Undo2, X, Loader2, CircleAlert,
  Sparkles, Search, ArrowLeft,
} from "lucide-react";
import type { DeskBooking } from "@/lib/desk";

const PRIMARY = "#8B1D24";
const TEXT    = "#3B2A24";
const MUTED   = "#A08070";
const BORDER  = "#E8D8CC";
const BG      = "#FDF8F3";
const GREEN   = "#166534";
const GREENBG = "#F0FDF4";

interface StaffItem { id: string; name: string }
interface BoardState { branchId: string; todayYmd: string; staff: StaffItem[]; bookings: DeskBooking[] }

export default function DeskBoard({
  branchName, initial,
}: {
  branchName: string;
  initial: BoardState;
}) {
  const router = useRouter();
  const [board, setBoard]   = useState<BoardState>(initial);
  const [now, setNow]       = useState(() => Date.now());
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [busy, setBusy]     = useState<Set<string>>(new Set());
  const [error, setError]   = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // While an action is in flight, polling must not overwrite optimistic state.
  const pendingRef = useRef(0);

  const refresh = useCallback(async () => {
    if (pendingRef.current > 0) return;
    try {
      setSyncing(true);
      const res = await fetch("/api/kiosk/bookings", { cache: "no-store" });
      if (res.status === 401) { router.replace("/desk/setup"); return; }
      if (!res.ok) return;
      const data = await res.json();
      if (pendingRef.current > 0) return; // an action started mid-fetch
      setBoard({ branchId: data.branchId, todayYmd: data.todayYmd, staff: data.staff, bookings: data.bookings });
    } catch { /* keep last good state */ }
    finally { setSyncing(false); }
  }, [router]);

  // Poll the board every 20s so the two devices + admin stay in sync — but only
  // while the screen is awake. A sleeping / backgrounded device stops polling
  // (no DB load) and refreshes immediately when it wakes.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") { setNow(Date.now()); refresh(); }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  // The clock + "in service for N min" labels are minute-precision, so a 30s
  // tick is plenty — avoids re-rendering the whole board every second (needless
  // work that was noticeable on older in-store hardware).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  function patchBooking(id: string, patch: Partial<DeskBooking>) {
    setBoard(b => ({ ...b, bookings: b.bookings.map(x => x.id === id ? { ...x, ...patch } : x) }));
  }

  // Run a mutation: optimistic patch → POST → reconcile via refresh.
  async function act(id: string, optimistic: Partial<DeskBooking>, url: string, body: object, errMsg: string) {
    pendingRef.current += 1;
    setBusy(s => new Set(s).add(id));
    patchBooking(id, optimistic);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? errMsg);
      }
    } catch {
      setError(errMsg);
    } finally {
      pendingRef.current -= 1;
      setBusy(s => { const n = new Set(s); n.delete(id); return n; });
      refresh();
    }
  }

  function checkin(b: DeskBooking, staff: StaffItem) {
    act(b.id,
      { staffId: staff.id, staffName: staff.name, checkedInAt: new Date().toISOString(),
        deskStatus: "IN_SERVICE", status: b.status === "PENDING" ? "CONFIRMED" : b.status },
      "/api/kiosk/checkin", { bookingId: b.id, staffId: staff.id }, "เช็คอินไม่สำเร็จ");
  }
  function finish(b: DeskBooking) {
    act(b.id, { deskStatus: "DONE", status: "COMPLETED" },
      "/api/kiosk/finish", { bookingId: b.id }, "บันทึกเสร็จสิ้นไม่สำเร็จ");
  }
  function undo(b: DeskBooking) {
    const optimistic: Partial<DeskBooking> = b.deskStatus === "DONE"
      ? { deskStatus: "IN_SERVICE", status: "CONFIRMED" }
      : { deskStatus: "WAITING", checkedInAt: null };
    act(b.id, optimistic, "/api/kiosk/undo", { bookingId: b.id }, "ย้อนกลับไม่สำเร็จ");
  }

  const waiting   = board.bookings.filter(b => b.deskStatus === "WAITING");
  const inService = board.bookings.filter(b => b.deskStatus === "IN_SERVICE");
  const done      = board.bookings.filter(b => b.deskStatus === "DONE");

  const clockDate = new Date(now);
  const timeStr = clockDate.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const dateStr = clockDate.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="min-h-screen pb-32" style={{ background: BG }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3" style={{ background: PRIMARY }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-white text-xl font-bold leading-tight truncate">{branchName}</h1>
            <p className="text-white/70 text-xs mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right mr-1 hidden sm:block">
              <p className="text-white text-2xl font-bold leading-none tabular-nums">{timeStr}</p>
            </div>
            <button onClick={refresh} title="รีเฟรช"
              className="p-3 rounded-2xl text-white/90 active:scale-95 transition-transform"
              style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
              <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
            </button>
            <a href="/desk/setup" title="ตั้งค่าอุปกรณ์"
              className="p-3 rounded-2xl text-white/80 active:scale-95 transition-transform"
              style={{ border: "1px solid rgba(255,255,255,0.3)" }}>
              <Settings size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* Per-staff customer counts removed from the shared board by owner
          request (2026-07-04) — the admin Live view still has them. */}
      <div className="max-w-7xl mx-auto px-4 pt-4 space-y-5">
        {/* Waiting — primary action area */}
        <section>
          <SectionHeader title="รอเช็คอิน" count={waiting.length} color="#9A3412" />
          {waiting.length === 0 ? (
            <EmptyHint text="ไม่มีลูกค้าที่รอเช็คอิน" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {waiting.map(b => (
                <WaitingCard key={b.id} b={b} staff={board.staff} busy={busy.has(b.id)} onCheckin={checkin} />
              ))}
            </div>
          )}
        </section>

        {/* In service + Done */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section>
            <SectionHeader title="กำลังบริการ" count={inService.length} color={PRIMARY} />
            {inService.length === 0 ? (
              <EmptyHint text="ยังไม่มีลูกค้าที่กำลังบริการ" />
            ) : (
              <div className="space-y-3">
                {inService.map(b => (
                  <InServiceCard key={b.id} b={b} now={now} busy={busy.has(b.id)} onFinish={finish} onUndo={undo} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="เสร็จสิ้นวันนี้" count={done.length} color={GREEN} />
            {done.length === 0 ? (
              <EmptyHint text="ยังไม่มีรายการที่เสร็จสิ้น" />
            ) : (
              <div className="space-y-2">
                {done.map(b => (
                  <DoneCard key={b.id} b={b} busy={busy.has(b.id)} onUndo={undo} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Fixed bottom action bar — the walk-in buttons live here so they're
          always within reach on the standing iPad, no scrolling back up. */}
      <div className="fixed bottom-0 inset-x-0 z-40 px-4 pt-3"
        style={{
          background: "rgba(253,248,243,0.96)",
          borderTop: `1px solid ${BORDER}`,
          backdropFilter: "blur(8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        }}>
        <div className="max-w-7xl mx-auto flex gap-3">
          <button onClick={() => setWalkinOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold active:scale-[0.98] transition-transform"
            style={{ background: PRIMARY, color: "white" }}>
            <UserPlus size={22} /> วอร์คอิน
          </button>
          <button onClick={() => setMemberOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold active:scale-[0.98] transition-transform"
            style={{ background: GREEN, color: "white" }}>
            <Sparkles size={20} /> วอร์คอิน สมาชิก
          </button>
        </div>
      </div>

      {/* Error toast — sits above the bottom action bar */}
      {error && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}>
          <CircleAlert size={16} /> {error}
        </div>
      )}

      {walkinOpen && (
        <WalkinModal staff={board.staff}
          onClose={() => setWalkinOpen(false)}
          onDone={() => { setWalkinOpen(false); refresh(); }}
          onError={setError} />
      )}

      {memberOpen && (
        <MemberWalkinModal staff={board.staff}
          onClose={() => setMemberOpen(false)}
          onDone={() => { setMemberOpen(false); refresh(); }}
          onError={setError} />
      )}
    </main>
  );
}

// ── Section helpers ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <h2 className="text-base font-bold" style={{ color: TEXT }}>{title}</h2>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: color, color: "white" }}>
        {count}
      </span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-6 text-center text-sm" style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
      {text}
    </div>
  );
}

function CustomerLine({ b }: { b: DeskBooking }) {
  return (
    <p className="text-lg font-bold leading-tight" style={{ color: TEXT }}>
      {b.customerName}
      {b.customerNickname && <span className="text-sm font-normal ml-1.5" style={{ color: MUTED }}>({b.customerNickname})</span>}
      {b.isWalkin && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 align-middle"
          style={{ background: "#FEF3C7", color: "#92400E" }}>วอร์คอิน</span>
      )}
    </p>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────────

function WaitingCard({ b, staff, busy, onCheckin }: {
  b: DeskBooking; staff: StaffItem[]; busy: boolean; onCheckin: (b: DeskBooking, s: StaffItem) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5" style={{ border: `1.5px solid ${BORDER}`, opacity: busy ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <CustomerLine b={b} />
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>{b.serviceName}</p>
        </div>
        <span className="text-sm font-bold tabular-nums flex-shrink-0 px-2 py-1 rounded-lg"
          style={{ background: "#FFF8F4", color: PRIMARY }}>{b.startTime}</span>
      </div>
      {b.notes && <p className="text-xs mb-2 px-2 py-1 rounded-lg" style={{ background: "#FFFBEB", color: "#92400E" }}>📝 {b.notes}</p>}
      <p className="text-[11px] font-semibold mb-1.5" style={{ color: MUTED }}>แตะชื่อช่างเมื่อลูกค้ามาถึง</p>
      <div className="flex flex-wrap gap-2">
        {staff.length === 0 && <span className="text-xs" style={{ color: MUTED }}>ยังไม่มีพนักงาน</span>}
        {staff.map(s => (
          <button key={s.id} disabled={busy} onClick={() => onCheckin(b, s)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
            style={{ background: PRIMARY, color: "white" }}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function InServiceCard({ b, now, busy, onFinish, onUndo }: {
  b: DeskBooking; now: number; busy: boolean; onFinish: (b: DeskBooking) => void; onUndo: (b: DeskBooking) => void;
}) {
  const mins = b.checkedInAt ? Math.max(0, Math.floor((now - Date.parse(b.checkedInAt)) / 60000)) : 0;
  return (
    <div className="rounded-2xl bg-white p-3.5" style={{ border: `2px solid ${PRIMARY}`, opacity: busy ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <CustomerLine b={b} />
          <p className="text-sm mt-0.5" style={{ color: MUTED }}>{b.serviceName} · {b.startTime}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-sm font-bold px-2.5 py-1 rounded-lg" style={{ background: PRIMARY, color: "white" }}>
              ช่าง {b.staffName ?? "—"}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
              <Clock size={12} /> {mins} นาที
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button disabled={busy} onClick={() => onFinish(b)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-base font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: GREEN, color: "white" }}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} เสร็จแล้ว
        </button>
        <button disabled={busy} onClick={() => onUndo(b)} title="ยกเลิกเช็คอิน"
          className="flex items-center gap-1 px-3 py-3 rounded-xl text-xs font-semibold active:scale-95 transition-transform disabled:opacity-50"
          style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
          <Undo2 size={15} />
        </button>
      </div>
    </div>
  );
}

function DoneCard({ b, busy, onUndo }: { b: DeskBooking; busy: boolean; onUndo: (b: DeskBooking) => void }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-3" style={{ background: GREENBG, border: "1px solid #BBF7D0", opacity: busy ? 0.6 : 1 }}>
      <Check size={18} style={{ color: GREEN }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>
          {b.customerName}
          {b.isWalkin && <span className="text-[10px] ml-1.5" style={{ color: MUTED }}>(วอร์คอิน)</span>}
        </p>
        <p className="text-xs truncate" style={{ color: MUTED }}>{b.serviceName} · ช่าง {b.staffName ?? "—"}</p>
      </div>
      {/* Read-only payment badge — only admin flows can mark a booking paid. */}
      {!b.paidAt && (
        <span className="text-[11px] font-semibold px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" }}>
          ยังไม่ชำระ
        </span>
      )}
      <button disabled={busy} onClick={() => onUndo(b)} title="ย้อนกลับ"
        className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg active:scale-95 transition-transform disabled:opacity-50"
        style={{ color: MUTED }}>
        <Undo2 size={14} /> ย้อนกลับ
      </button>
    </div>
  );
}

// ── Walk-in modal ────────────────────────────────────────────────────────────────

// Walk-in is always wash & blow (สระไดร์) — no service picker. Tap the serving
// staff to start immediately, or "ยังไม่ระบุช่าง" to drop it into the waiting
// list for someone to pick up.
function WalkinModal({ staff, onClose, onDone, onError }: {
  staff: StaffItem[];
  onClose: () => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function create(staffId: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kiosk/walkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffId ? { staffId } : {}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error ?? "บันทึกไม่สำเร็จ");
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      onError("เกิดข้อผิดพลาด");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ background: PRIMARY }}>
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><UserPlus size={20} /> ลูกค้าวอร์คอิน · สระไดร์</h2>
          <button onClick={onClose} className="text-white/80 p-1"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-base font-bold mb-1" style={{ color: TEXT }}>ใครเป็นช่าง?</p>
          <p className="text-xs mb-4" style={{ color: MUTED }}>แตะชื่อช่างเพื่อเริ่มบริการ หรือเลือก “ยังไม่ระบุช่าง”</p>
          {saving ? (
            <div className="flex items-center justify-center py-12" style={{ color: MUTED }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <StaffPickGrid staff={staff} onPick={create} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Shared "who's serving?" grid — staff buttons + ยังไม่ระบุช่าง. */
function StaffPickGrid({ staff, onPick }: { staff: StaffItem[]; onPick: (staffId: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {staff.map(s => (
        <button key={s.id} onClick={() => onPick(s.id)}
          className="py-5 rounded-2xl text-lg font-bold active:scale-95 transition-transform"
          style={{ background: PRIMARY, color: "white" }}>
          {s.name}
        </button>
      ))}
      <button onClick={() => onPick("")}
        className="py-5 rounded-2xl text-base font-semibold active:scale-95 transition-transform"
        style={{ background: "white", color: TEXT, border: `1.5px solid ${BORDER}` }}>
        ยังไม่ระบุช่าง
      </button>
    </div>
  );
}

// ── Member walk-in modal ─────────────────────────────────────────────────────────

interface MemberLookup {
  customer:    { id: string; name: string; nickname: string | null; phone: string };
  isMember:    boolean;
  memberUntil: string | null;
  packages:    { sku: string; expiresAt: string; usagesLeft: number | null }[];
  price:       number; // satang — member price when the membership is valid
}

const PKG_LABEL: Record<string, string> = { "svc-buffet": "บุฟเฟ่ต์", "svc-pkg5": "แพ็กเกจ 5 ครั้ง" };

function thShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" });
}

/** Member walk-in: search the customer by name / nickname / phone, pick the
 *  right person if several match, then pick the serving staff. The booking
 *  lands on the real customer record (member price applied server-side; the
 *  visit counts toward the membership). */
function MemberWalkinModal({ staff, onClose, onDone, onError }: {
  staff: StaffItem[];
  onClose: () => void; onDone: () => void; onError: (msg: string) => void;
}) {
  const [q, setQ]               = useState("");
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MemberLookup[] | null>(null);
  const [result, setResult]     = useState<MemberLookup | null>(null);
  const [saving, setSaving]     = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (searching || q.trim().length < 2) { setLookupError("พิมพ์อย่างน้อย 2 ตัวอักษร"); return; }
    setSearching(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/kiosk/member?q=${encodeURIComponent(q.trim())}`);
      const d = await res.json();
      if (!res.ok) { setLookupError(d.error ?? "ไม่พบลูกค้า"); return; }
      const results: MemberLookup[] = d.results ?? [];
      // Single match → straight to the confirmation card; else let staff pick.
      if (results.length === 1) setResult(results[0]);
      else setCandidates(results);
    } catch {
      setLookupError("เกิดข้อผิดพลาด — ลองอีกครั้ง");
    } finally {
      setSearching(false);
    }
  }

  function resetSearch() {
    setResult(null);
    setCandidates(null);
    setLookupError(null);
  }

  async function create(staffId: string) {
    if (saving || !result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kiosk/walkin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: result.customer.id, ...(staffId ? { staffId } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        onError(d.error ?? "บันทึกไม่สำเร็จ");
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      onError("เกิดข้อผิดพลาด");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ background: GREEN }}>
          <h2 className="text-white font-bold text-lg flex items-center gap-2"><Sparkles size={20} /> วอร์คอิน สมาชิก · สระไดร์</h2>
          <button onClick={onClose} className="text-white/80 p-1"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!result && !candidates ? (
            <form onSubmit={search}>
              <p className="text-base font-bold mb-1" style={{ color: TEXT }}>ค้นหาสมาชิก</p>
              <p className="text-xs mb-3" style={{ color: MUTED }}>พิมพ์ชื่อ ชื่อเล่น หรือเบอร์โทรของลูกค้า</p>
              <div className="flex gap-2">
                <input
                  type="text" autoFocus
                  value={q}
                  onChange={e => { setQ(e.target.value); setLookupError(null); }}
                  placeholder="เช่น แนน หรือ 089…"
                  className="flex-1 min-w-0 rounded-2xl px-4 py-4 text-xl font-semibold outline-none"
                  style={{ border: `1.5px solid ${BORDER}`, color: TEXT, background: BG }}
                />
                <button type="submit" disabled={searching}
                  className="flex items-center gap-2 px-5 rounded-2xl text-base font-bold active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: GREEN, color: "white" }}>
                  {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />} ค้นหา
                </button>
              </div>
              {lookupError && (
                <p className="flex items-center gap-1.5 text-sm font-medium mt-3" style={{ color: "#991B1B" }}>
                  <CircleAlert size={15} /> {lookupError}
                </p>
              )}
            </form>
          ) : !result && candidates ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-bold" style={{ color: TEXT }}>เลือกลูกค้า ({candidates.length})</p>
                <button onClick={resetSearch}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                  style={{ color: MUTED, border: `1px solid ${BORDER}` }}>
                  <ArrowLeft size={12} /> ค้นหาใหม่
                </button>
              </div>
              <div className="space-y-2">
                {candidates.map(c => (
                  <button key={c.customer.id} onClick={() => setResult(c)}
                    className="w-full text-left rounded-2xl px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform"
                    style={{ background: "white", border: `1.5px solid ${BORDER}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold truncate" style={{ color: TEXT }}>
                        {c.customer.name}
                        {c.customer.nickname && <span className="text-sm font-normal ml-1.5" style={{ color: MUTED }}>({c.customer.nickname})</span>}
                      </p>
                      <p className="text-xs" style={{ color: MUTED }}>{c.customer.phone}</p>
                    </div>
                    {c.isMember ? (
                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: GREENBG, color: GREEN }}>
                        <Sparkles size={11} /> สมาชิก
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: "#F3F4F6", color: MUTED }}>
                        ทั่วไป
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : result ? (
            <div>
              {/* Found customer + membership state */}
              <div className="rounded-2xl p-4 mb-4"
                style={{ background: result.isMember ? GREENBG : "#FFFBEB", border: `1.5px solid ${result.isMember ? "#BBF7D0" : "#FDE68A"}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight" style={{ color: TEXT }}>
                      {result.customer.name}
                      {result.customer.nickname && <span className="text-sm font-normal ml-1.5" style={{ color: MUTED }}>({result.customer.nickname})</span>}
                    </p>
                    {result.isMember ? (
                      <p className="flex items-center gap-1 text-sm font-semibold mt-1" style={{ color: GREEN }}>
                        <Sparkles size={14} /> สมาชิก{result.memberUntil ? ` · ถึง ${thShortDate(result.memberUntil)}` : ""}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold mt-1" style={{ color: "#B45309" }}>
                        ไม่ใช่สมาชิก / หมดอายุ — คิดราคาปกติ
                      </p>
                    )}
                    {result.packages.map(p => (
                      <p key={p.sku} className="text-xs mt-1" style={{ color: MUTED }}>
                        🎟️ {PKG_LABEL[p.sku] ?? p.sku} · ถึง {thShortDate(p.expiresAt)}
                        {p.usagesLeft != null ? ` · เหลือ ${p.usagesLeft} ครั้ง` : ""}
                      </p>
                    ))}
                  </div>
                  <span className="text-lg font-bold flex-shrink-0" style={{ color: result.isMember ? GREEN : TEXT }}>
                    ฿{(result.price / 100).toLocaleString()}
                  </span>
                </div>
                <button onClick={() => { setResult(null); setLookupError(null); }}
                  className="flex items-center gap-1 text-xs font-semibold mt-2 px-2 py-1 rounded-lg active:scale-95 transition-transform"
                  style={{ color: MUTED, border: `1px solid ${BORDER}`, background: "white" }}>
                  <ArrowLeft size={12} /> ค้นหาใหม่
                </button>
              </div>

              <p className="text-base font-bold mb-1" style={{ color: TEXT }}>ใครเป็นช่าง?</p>
              <p className="text-xs mb-4" style={{ color: MUTED }}>แตะชื่อช่างเพื่อเริ่มบริการ หรือเลือก “ยังไม่ระบุช่าง”</p>
              {saving ? (
                <div className="flex items-center justify-center py-12" style={{ color: MUTED }}>
                  <Loader2 size={24} className="animate-spin" />
                </div>
              ) : (
                <StaffPickGrid staff={staff} onPick={create} />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
