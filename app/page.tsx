"use client";

import dynamic from "next/dynamic";

const WalletConnectPanel = dynamic(() => import("./wallet-connect-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.9)] p-6 text-xs text-[var(--text-muted)] shadow-xl md:p-8">
      Loading wallet connector...
    </div>
  ),
});

export default function Home() {
  return (
    <div className="relative h-screen overflow-y-auto custom-scrollbar bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 md:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-12 lg:gap-14">
          <section className="lg:col-span-7">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.4em] text-[var(--highlight)]">
              Global Farming Strategy
            </p>
            <h1 className="mb-6 max-w-3xl text-5xl font-black leading-[0.92] tracking-tight text-[var(--foreground)] md:text-7xl">
              Welcome to
              <span className="block text-[var(--highlight)] drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
                ChronoFarm
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] md:text-lg">
              Connect with Rainbow Wallet, create your player account, then farm, trade, and chat across the game’s global economy.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-primary)]">Rainbow Wallet</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">Use RainbowKit to connect your wallet and create a profile.</div>
              </div>
              <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--accent-secondary)]">Global Chat</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">Talk to other players in the Section page.</div>
              </div>
              <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--highlight)]">Crypto Listings</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">List crops with quantity and crypto-denominated prices.</div>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5">
            <WalletConnectPanel />
          </section>
        </div>
      </main>
    </div>
  );
}
