const BORDER = "#E8D8CC";

export default function Loading() {
  return (
    <main className="pb-32 animate-pulse">
      <header className="bg-white" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-9 h-9 rounded-full" style={{ background: "#F0E4D8" }} />
          <div className="h-5 w-32 rounded" style={{ background: "#F0E4D8" }} />
        </div>
      </header>
      <div className="px-4 py-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 rounded" style={{ background: "#F0E4D8" }} />
            <div className="h-10 rounded-xl" style={{ background: "#F9F4F0" }} />
          </div>
        ))}
        <div className="h-12 rounded-xl" style={{ background: "#F0E4D8" }} />
      </div>
    </main>
  );
}
