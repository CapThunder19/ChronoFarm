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

      <div className="flex w-full flex-col">
        <ConnectButton.Custom>
          {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
            const ready = mounted && authenticationStatus !== "loading";
            const connected =
              ready &&
              account &&
              chain &&
              (!authenticationStatus || authenticationStatus === "authenticated");

            return (
              <div
                {...(!ready && {
                  "aria-hidden": true,
                  style: {
                    opacity: 0,
                    pointerEvents: "none",
                    userSelect: "none",
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <button
                        onClick={openConnectModal}
                        type="button"
                        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-cyan-500 px-6 py-4 font-bold text-black transition-all hover:bg-cyan-400 active:scale-[0.98]"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Connect Your Wallet
                        </span>
                        <div className="absolute inset-0 z-0 bg-gradient-to-r from-cyan-400 via-lime-400 to-cyan-400 opacity-0 transition-opacity duration-500 group-hover:opacity-20" />
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 px-6 py-4 font-bold text-red-500 transition-all hover:bg-red-500/20"
                      >
                        Wrong network
                      </button>
                    );
                  }

                  return (
                    <div className="flex w-full flex-col gap-3">
                      <button
                        onClick={openAccountModal}
                        type="button"
                        className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 px-5 py-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-bold text-white">{account.displayName}</span>
                            <span className="text-xs text-zinc-500">
                              {account.displayBalance ? `Balance: ${account.displayBalance}` : "Connected"}
                            </span>
                          </div>
                        </div>
                        <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
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