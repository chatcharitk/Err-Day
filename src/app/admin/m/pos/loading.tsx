const BORDER = "#E8D8CC";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse" style={{ background: "#FDF7F2", minHeight: "100vh" }}>
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="h-5 w-12 rounded flex-1" style={{ background: "#F0E4D8" }} />
          <div className="h-9 w-32 rounded-full" style={{ background: "#F0E4D8" }} />
        </div>
      </header>
      <section className="px-4 py-3">
        <div className="h-3 w-12 rounded mb-2" style={{ background: "#F0E4D8" }} />
        <div className="h-10 rounded-lg" style={{ background: "#F9F4F0" }} />
      </section>
      <section className="px-4 py-2 space-y-4">
        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi}>
            <div className="h-3 w-24 rounded mb-2" style={{ background: "#F0E4D8" }} />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl p-3 h-20" style={{ background: "white", border: `1px solid ${BORDER}` }}>
                  <div className="h-3 rounded w-3/4 mb-2" style={{ background: "#F0E4D8" }} />
                  <div className="h-2.5 rounded w-1/2" style={{ background: "#F5EFE9" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
