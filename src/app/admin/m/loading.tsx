/**
 * Skeleton shown while /admin/m server-fetches today's bookings.
 * Matches the real layout (top bar + date strip + cards) so the page
 * doesn't visually shift when content arrives.
 */
const BORDER = "#E8D8CC";
const MUTED  = "#A08070";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse">
      {/* Top bar shell */}
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="h-5 w-20 rounded" style={{ background: "#F0E4D8" }} />
          <div className="flex gap-1">
            <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
            <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
            <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="rounded-xl h-10" style={{ background: "#F9F4F0" }} />
        </div>
        <div className="px-2 pb-3 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl h-14 min-w-[52px]" style={{ background: "#F9F4F0" }} />
          ))}
        </div>
      </header>

      <section className="px-5 pt-5 pb-2">
        <div className="h-5 w-40 rounded mb-1" style={{ background: "#F0E4D8" }} />
        <div className="h-3 w-16 rounded" style={{ background: "#F5EFE9" }} />
      </section>

      <section className="px-4 pb-6 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 flex items-start gap-3" style={{ border: `1px solid ${BORDER}` }}>
            <div className="rounded-xl flex-shrink-0" style={{ background: "#F9F4F0", width: 60, height: 56 }} />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded w-1/2" style={{ background: "#F0E4D8" }} />
              <div className="h-3 rounded w-3/4" style={{ background: "#F5EFE9" }} />
              <div className="h-2.5 rounded w-2/3" style={{ background: "#F5EFE9" }} />
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-xs" style={{ color: MUTED }}>กำลังโหลด...</p>
    </main>
  );
}
