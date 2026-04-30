const BORDER = "#E8D8CC";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse">
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 rounded w-12" style={{ background: "#F5EFE9" }} />
            <div className="h-3.5 rounded w-40" style={{ background: "#F0E4D8" }} />
          </div>
        </div>
      </header>

      <section className="px-4 pt-4 grid grid-cols-2 gap-2">
        <div className="h-14 rounded-xl" style={{ background: "#F9F4F0" }} />
        <div className="h-14 rounded-xl" style={{ background: "#F9F4F0" }} />
      </section>

      <section className="px-4 pt-5 space-y-2">
        <div className="h-2.5 w-12 rounded mb-1.5" style={{ background: "#F5EFE9" }} />
        <div className="h-12 rounded-xl" style={{ background: "#F9F4F0" }} />
        <div className="h-12 rounded-xl" style={{ background: "#F9F4F0" }} />
        <div className="h-12 rounded-xl" style={{ background: "#F9F4F0" }} />
      </section>

      <section className="px-4 pt-5">
        <div className="h-2.5 w-12 rounded mb-1.5" style={{ background: "#F5EFE9" }} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl" style={{ background: "#F9F4F0" }} />
          ))}
        </div>
      </section>
    </main>
  );
}
