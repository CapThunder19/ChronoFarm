"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { setStoredWalletAddress } from "@/lib/wallet-session";
import Link from "next/link";
import { Users, Leaf, CircleDollarSign, Globe, Play, ChevronDown, WalletCards, Flower2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const lastBootstrappedAddress = useRef("");

  useEffect(() => {
    const bootstrapWallet = async () => {
      if (!isConnected || !address) {
        return;
      }

      const normalized = address.toLowerCase();
      if (lastBootstrappedAddress.current === normalized) {
        setStoredWalletAddress(normalized);
        router.push("/farm");
        return;
      }

      try {
        setIsBootstrapping(true);
        setStatus("Creating account...");
        setStoredWalletAddress(normalized);

        const res = await fetch("/api/connect-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: normalized }),
        });

        if (!res.ok) {
          setStatus("Connection failed.");
          return;
        }

        lastBootstrappedAddress.current = normalized;
        setStatus("Entering farm...");
        router.push("/farm");
      } catch (error) {
        setStatus("Connection failed.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrapWallet();
  }, [address, isConnected, router]);

  return (
    <div className="relative min-h-screen bg-[#050604] text-white font-sans selection:bg-[#d6a85f]/30">
      {/* BACKGROUND IMAGE */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 opacity-90"
        style={{ backgroundImage: "url('/landing-bg.png')" }}
      />
      {/* Gradient Overlays for better text readability */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent" />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-transparent to-black/95" />

      {/* NAVBAR */}
      <header className="relative z-10 flex items-start justify-start gap-12 lg:gap-32 px-8 md:px-16 lg:px-24 py-8 w-full">
        <div className="flex flex-col items-center">
          <Flower2 className="w-6 h-6 text-[#d6a85f] mb-1.5" />
          <span className="text-xl md:text-2xl font-serif tracking-widest text-zinc-100 uppercase">CHRONOFARM</span>
          <span className="text-[10px] text-zinc-400 tracking-[0.1em] mt-1">Grow Today, Thrive Forever</span>
        </div>
        
        <nav className="hidden lg:flex items-center gap-12 text-[11px] tracking-[0.15em] text-zinc-400 mt-3">
          <Link href="#" className="text-[#d6a85f] relative flex flex-col items-center transition-colors">
            HOME
            <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-[#d6a85f]" />
            <span className="absolute -bottom-2 w-8 h-[1px] bg-gradient-to-r from-transparent via-[#d6a85f] to-transparent" />
          </Link>
          <Link href="/marketplace" className="hover:text-zinc-200 transition-colors">MARKETPLACE</Link>
          <Link href="#" className="hover:text-zinc-200 transition-colors">WORLD</Link>
          <Link href="#" className="hover:text-zinc-200 transition-colors">DOCS</Link>
          <Link href="#" className="hover:text-zinc-200 transition-colors">ABOUT</Link>
        </nav>
      </header>

      {/* HERO CONTENT */}
      <main className="relative z-10 flex flex-col justify-center min-h-[65vh] px-8 md:px-16 lg:px-24 w-full">
        <div className="max-w-xl">
          <h1 className="text-[40px] md:text-[68px] leading-[1.05] font-serif tracking-tight text-zinc-100 drop-shadow-2xl mb-2">
            Build your legacy.
          </h1>
          <h1 className="text-[40px] md:text-[68px] leading-[1.05] font-serif tracking-tight text-[#d6a85f] drop-shadow-2xl">
            Farm across time.
          </h1>

          <div className="flex items-center gap-3 my-8">
            <div className="h-[1px] w-6 bg-[#d6a85f]/30" />
            <Flower2 className="w-3.5 h-3.5 text-[#d6a85f]/80" />
            <div className="h-[1px] w-6 bg-[#d6a85f]/30" />
          </div>

          <p className="text-zinc-300/90 text-[15px] md:text-[17px] leading-relaxed max-w-[420px]">
            ChronoFarm is a global farming strategy game where you grow crops, trade resources, and shape the economy across decades.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-5 mt-10">
            <ConnectButton.Custom>
              {({ openConnectModal }) => {
                return (
                  <button
                    onClick={openConnectModal}
                    className="flex items-center justify-center gap-3 px-7 py-3.5 rounded-lg bg-[#112a1a]/80 backdrop-blur-sm border border-[#2aa86a]/60 text-zinc-100 text-[11px] font-bold tracking-widest hover:bg-[#1a402a]/90 hover:border-[#2aa86a] transition-all shadow-[0_0_25px_rgba(42,168,106,0.15)] group w-full sm:w-auto"
                  >
                    <WalletCards className="w-4 h-4 text-[#2aa86a] group-hover:scale-110 transition-transform" />
                    {isBootstrapping ? "CONNECTING..." : (status ? status.toUpperCase() : "CONNECT WALLET")}
                  </button>
                );
              }}
            </ConnectButton.Custom>

            <button className="flex items-center justify-center gap-3 px-7 py-3.5 rounded-lg bg-black/20 backdrop-blur-sm border border-zinc-700 text-zinc-300 text-[11px] font-bold tracking-widest hover:bg-white/5 hover:border-zinc-500 transition-all w-full sm:w-auto group">
              <div className="flex items-center justify-center w-5 h-5 rounded-full border border-zinc-500 group-hover:border-zinc-300 transition-colors">
                <Play className="w-2.5 h-2.5 ml-0.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
              </div>
              HOW IT WORKS
            </button>
          </div>
        </div>
      </main>

      {/* BOTTOM SECTION */}
      <div className="relative z-10 px-8 md:px-16 lg:px-24 pb-12 w-full flex flex-col justify-end min-h-[15vh]">
        
        {/* STATS BAR */}
        <div className="inline-flex flex-col lg:flex-row items-start lg:items-center gap-8 lg:gap-14 px-8 md:px-10 py-6 rounded-2xl bg-[#0a0f0c]/60 backdrop-blur-xl border border-white/5 shadow-2xl max-w-fit mt-8 lg:mt-0">
          
          <div className="flex items-center gap-4">
            <Users className="w-7 h-7 text-[#2aa86a] stroke-[1.5]" />
            <div>
              <div className="text-xl md:text-2xl font-serif text-zinc-100">24,531+</div>
              <div className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">Active Farmers</div>
            </div>
          </div>
          
          <div className="w-[1px] h-12 bg-white/5 hidden lg:block" />
          
          <div className="flex items-center gap-4">
            <Leaf className="w-7 h-7 text-[#2aa86a] stroke-[1.5]" />
            <div>
              <div className="text-xl md:text-2xl font-serif text-zinc-100">1.2M+</div>
              <div className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">Crops Harvested</div>
            </div>
          </div>

          <div className="w-[1px] h-12 bg-white/5 hidden lg:block" />
          
          <div className="flex items-center gap-4">
            <CircleDollarSign className="w-7 h-7 text-[#d6a85f] stroke-[1.5]" />
            <div>
              <div className="text-xl md:text-2xl font-serif text-[#d6a85f]">{"$" + "2.43M+"}</div>
              <div className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">Volume Traded</div>
            </div>
          </div>

          <div className="w-[1px] h-12 bg-white/5 hidden lg:block" />

          <div className="flex items-center gap-4">
            <Globe className="w-7 h-7 text-[#2aa86a] stroke-[1.5]" />
            <div>
              <div className="text-xl md:text-2xl font-serif text-zinc-100">42+</div>
              <div className="text-[10px] text-zinc-400 tracking-wider uppercase mt-0.5">Countries</div>
            </div>
          </div>

        </div>
      </div>

      {/* SCROLL TO EXPLORE - Centered on screen */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 pointer-events-none">
        <span className="text-[9px] text-zinc-500 tracking-[0.25em] uppercase drop-shadow-md">Scroll to explore</span>
        <ChevronDown className="w-5 h-5 text-[#2aa86a] animate-bounce drop-shadow-md" />
      </div>
    </div>
  );
}
