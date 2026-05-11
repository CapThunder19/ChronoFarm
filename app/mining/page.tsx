"use client";

import Link from "next/link";

export default function MiningPage() {
  return (
    <div className="min-h-screen bg-[#050604] text-zinc-100 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2a1f09_0%,#050604_60%)] opacity-95" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8 md:px-10">
        <header className="mb-8 border-b border-amber-900/40 pb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-400">ChronoFarm Systems</div>
          <h1 className="mt-3 text-4xl font-black tracking-tighter md:text-6xl">MINING</h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Mine resources here and prepare for future upgrades.
          </p>
        </header>

        <main className="grid flex-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-amber-900/40 bg-[rgba(18,12,6,0.88)] p-6 shadow-2xl lg:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Mining Site</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Copper</div>
                <div className="mt-2 text-2xl font-black text-amber-300">0</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Iron</div>
                <div className="mt-2 text-2xl font-black text-amber-300">0</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-400">Coal</div>
                <div className="mt-2 text-2xl font-black text-amber-300">0</div>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-zinc-400">
              This page is ready for your mining gameplay loop. You can extend it later with drills, stamina, resource drops, and mining quests.
            </p>
          </section>

          <aside className="rounded-2xl border border-zinc-800 bg-[rgba(11,11,11,0.9)] p-6 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Navigation</div>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/skills" className="btn-game btn-game-green px-4 py-3 text-xs font-bold uppercase tracking-[0.2em]">
                Back to Skills
              </Link>
              <Link href="/farm" className="btn-game btn-game-dark px-4 py-3 text-xs font-bold uppercase tracking-[0.2em]">
                Return to Farm
              </Link>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
