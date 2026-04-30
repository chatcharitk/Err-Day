const BORDER = "#E8D8CC";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse">
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 rounded w-12" style={{ background: "#F5EFE9" }} />
            <div className="h-3.5 rounded w-32" style={{ background: "#F0E4D8" }} />
          </div>
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="h-5 w-14 rounded-full" style={{ background: "#F0E4D8" }} />
        </div>
      </header>

      {/* Status pills shell */}
      <section className="px-4 pt-4">
        <div className="h-2.5 w-24 rounded mb-2" style={{ background: "#F5EFE9" }} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl" style={{ background: "#F9F4F0", border: `1.5px solid ${BORDER}` }} />
          ))}
        </div>
      </section>

      {/* Detail rows shell */}
      <section className="px-4 mt-5">
        <div className="rounded-2xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-3" style={{ borderBottom: i < 5 ? `1px solid #F5EFE9` : "none" }}>
              <div className="h-2.5 w-12 rounded" style={{ background: "#F5EFE9" }} />
              <div className="h-3.5 flex-1 rounded" style={{ background: "#F5EFE9" }} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
