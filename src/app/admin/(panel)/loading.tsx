/**
 * Skeleton shown while ANY page under /admin/(panel)/* is server-rendering.
 * Covers all desktop admin routes by default — eliminates the blank-screen
 * pause between clicking a sidebar item and the page appearing.
 *
 * Individual routes can override this by adding their own loading.tsx.
 */
const BORDER = "#E8D8CC";
const MUTED  = "#A08070";

export default function Loading() {
  return (
    <div className="px-6 py-8 max-w-7xl animate-pulse">
      {/* Page header */}
      <div className="mb-6">
        <div className="h-3 w-20 rounded mb-2" style={{ background: "#F5EFE9" }} />
        <div className="h-7 w-64 rounded mb-2" style={{ background: "#F0E4D8" }} />
        <div className="h-3.5 w-96 max-w-full rounded" style={{ background: "#F5EFE9" }} />
      </div>

      {/* Filter / control row */}
      <div className="flex gap-3 mb-6">
        <div className="h-11 w-48 rounded-xl" style={{ background: "#F9F4F0" }} />
        <div className="h-11 w-40 rounded-xl" style={{ background: "#F9F4F0" }} />
        <div className="h-11 w-28 rounded-xl ml-auto" style={{ background: "#F9F4F0" }} />
      </div>

      {/* Main content card */}
      <div className="rounded-2xl bg-white" style={{ border: `1.5px solid ${BORDER}` }}>
        {/* Card header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1.5px solid ${BORDER}` }}>
          <div className="h-4 w-48 rounded" style={{ background: "#F0E4D8" }} />
          <div className="h-7 w-24 rounded-full" style={{ background: "#F5EFE9" }} />
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: BORDER }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4" style={{ borderColor: BORDER }}>
              <div className="h-3.5 w-16 rounded flex-shrink-0" style={{ background: "#F0E4D8" }} />
              <div className="h-3.5 rounded flex-1" style={{ background: "#F5EFE9", maxWidth: 220 }} />
              <div className="h-3.5 w-20 rounded" style={{ background: "#F5EFE9" }} />
              <div className="h-3.5 w-24 rounded" style={{ background: "#F5EFE9" }} />
              <div className="h-6 w-20 rounded-full" style={{ background: "#F9F4F0" }} />
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs mt-6" style={{ color: MUTED }}>กำลังโหลด...</p>
    </div>
  );
}
