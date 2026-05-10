const BORDER = "#E8D8CC";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse">
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="h-5 w-16 rounded flex-1" style={{ background: "#F0E4D8" }} />
          <div className="w-20 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
        </div>
        <div className="px-4 pb-3">
          <div className="rounded-xl h-10" style={{ background: "#F9F4F0" }} />
        </div>
      </header>
      <section className="px-4 pt-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl p-3 flex items-center gap-3" style={{ border: `1px solid ${BORDER}`, background: "white" }}>
            <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: "#F0E4D8" }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 rounded w-1/2" style={{ background: "#F0E4D8" }} />
              <div className="h-2.5 rounded w-2/3" style={{ background: "#F5EFE9" }} />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
