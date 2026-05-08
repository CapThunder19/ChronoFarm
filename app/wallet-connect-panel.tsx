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
    <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.92)] p-6 shadow-xl md:p-8">
      <div className="mb-4 text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">
        Player Access
      </div>

      <h2 className="mb-2 text-2xl font-black tracking-tight text-[var(--foreground)]">Connect Wallet</h2>
      <p className="mb-6 text-sm leading-6 text-[var(--text-muted)]">
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
                        className="btn-game btn-game-green w-full"
                        style={{ padding: "12px 14px", fontSize: "12px" }}
                      >
                        <span className="flex items-center gap-2">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Connect Your Wallet
                        </span>
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        type="button"
                        className="btn-game btn-game-red w-full"
                        style={{ padding: "12px 14px", fontSize: "12px" }}
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
                        className="flex w-full items-center justify-between rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3 transition-all hover:border-[var(--highlight)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(var(--panel-bg-rgb),0.9)] text-[var(--accent-primary)] border border-[var(--game-border)]">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-bold text-[var(--foreground)]">{account.displayName}</span>
                            <span className="text-xs text-[var(--text-muted)]">
                              {account.displayBalance ? `Balance: ${account.displayBalance}` : "Connected"}
                            </span>
                          </div>
                        </div>
                        <svg className="h-5 w-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      <div className="mt-5 rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.7)] px-4 py-3 text-sm text-[var(--highlight)]">
        {isBootstrapping ? "Preparing your account..." : status}
      </div>

      <div className="mt-5 grid gap-3 text-xs text-[var(--text-muted)]">
        <div className="rounded-md border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.75)] px-4 py-3">
          Wallets are stored only for the current browser session.
        </div>
        <div className="rounded-md border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.75)] px-4 py-3">
          Use the Section page for chat and crypto listings after you enter the game.
        </div>
      </div>
    </div>
  );
}