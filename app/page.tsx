"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const WalletConnectPanel = dynamic(() => import("./wallet-connect-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-zinc-800 bg-black/55 p-7 text-sm text-zinc-500 shadow-2xl backdrop-blur-sm md:p-8">
      Loading wallet connector...
    </div>
  ),
});

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 md:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-12 lg:gap-14">
          <section className="lg:col-span-7">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.4em] text-cyan-300/80">
              Global Farming Strategy
            </p>
            <h1 className="mb-6 max-w-3xl text-5xl font-black leading-[0.92] tracking-tight text-white md:text-7xl">
              Welcome to
              <span className="block bg-gradient-to-r from-cyan-200 via-cyan-400 to-lime-300 bg-clip-text text-transparent">
                ChronoFarm
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Connect with Rainbow Wallet, create your player account, then farm, trade, and chat across the game’s global economy.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
                <div className="text-xs font-black uppercase tracking-widest text-cyan-300">Rainbow Wallet</div>
                <div className="mt-2 text-sm text-zinc-300">Use RainbowKit to connect your wallet and create a profile.</div>
              </div>
              <div className="rounded-2xl border border-lime-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
                <div className="text-xs font-black uppercase tracking-widest text-lime-300">Global Chat</div>
                <div className="mt-2 text-sm text-zinc-300">Talk to other players in the Section page.</div>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-zinc-900/60 p-4 backdrop-blur-sm">
                <div className="text-xs font-black uppercase tracking-widest text-amber-300">Crypto Listings</div>
                <div className="mt-2 text-sm text-zinc-300">List crops with quantity and crypto-denominated prices.</div>
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
