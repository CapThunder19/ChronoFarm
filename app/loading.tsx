export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center p-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.35em] text-zinc-400">
            Loading
          </span>
        </div>
      </div>
    </div>
  );
}
