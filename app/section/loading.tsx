export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">
            Loading Section
          </span>
        </div>
      </div>
    </div>
  );
}
