"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { setStoredWalletAddress } from "@/lib/wallet-session";

export default function WalletConnectPanel() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState("Connect your wallet to enter ChronoFarm.");
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
        setStatus("Creating your ChronoFarm account...");
        setStoredWalletAddress(normalized);

        const res = await fetch("/api/connect-wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ walletAddress: normalized }),
        });

        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || "Failed to prepare your account.");
          return;
        }

        lastBootstrappedAddress.current = normalized;
        setStatus("Wallet connected. Entering the farm...");
        router.push("/farm");
      } catch (error) {
        console.error(error);
        setStatus("Wallet connection failed.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrapWallet();
  }, [address, isConnected, router]);

  return (
    <div className="rounded-3xl border border-zinc-800 bg-black/55 p-7 shadow-2xl backdrop-blur-sm md:p-8">
      <div className="mb-4 text-[11px] font-black uppercase tracking-[0.35em] text-zinc-500">
        Player Access
      </div>

      <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Connect Wallet</h2>
      <p className="mb-6 text-sm leading-6 text-zinc-400">
        Choose any available wallet in the RainbowKit modal. Your account is created automatically after connection.
      </p>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
        <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
      </div>

      <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
        {isBootstrapping ? "Preparing your account..." : status}
      </div>

      <div className="mt-5 grid gap-3 text-xs text-zinc-400">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          Wallets are stored only for the current browser session.
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          Use the Section page for chat and crypto listings after you enter the game.
        </div>
      </div>
    </div>
  );
}