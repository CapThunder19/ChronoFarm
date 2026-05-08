"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";

type LeaderEntry = {
  walletAddress: string;
  displayName: string;
  money: number;
  maxLevel: number;
  totalXp: number;
  farmCount: number;
};

function shortWallet(address: string) {
  if (!address) {
    return "Unknown";
  }

  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
  const [walletAddress, setWalletAddress] = useState("");
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const walletFetch = useCallback(async (url: string, options?: RequestInit) => {
    const wallet = walletAddress || getStoredWalletAddress();
    if (!wallet) {
      router.push("/");
      throw new Error("Wallet missing");
    }

    return fetch(url, {
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        "x-wallet-address": wallet,
      },
    });
  }, [walletAddress, router]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await walletFetch("/api/leaderboard");
      const data = await res.json();

      if (!res.ok) {
        setStatus(data.error || "Failed to load leaderboard");
        return;
      }

      setLeaders(data.leaderboard ?? []);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Failed to load leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, [walletFetch]);

  useEffect(() => {
    const wallet = getStoredWalletAddress();
    if (!wallet) {
      router.push("/");
      return;
    }

    setWalletAddress(wallet);
  }, [router]);

  useEffect(() => {
    if (!walletAddress) return;

    void loadLeaderboard();
  }, [walletAddress, loadLeaderboard]);

  const handleLogout = async () => {
    try {
      await disconnectAsync();
    } catch (error) {
      console.error("Failed to disconnect wallet", error);
    } finally {
      clearWalletSession();
      router.push("/");
    }
  };

  const totalPlayers = leaders.length;
  const topBalance = leaders[0]?.money ?? 0;
  const userRank = useMemo(() => {
    if (!walletAddress) return null;
    const index = leaders.findIndex((leader) => leader.walletAddress.toLowerCase() === walletAddress.toLowerCase());
    return index >= 0 ? index + 1 : null;
  }, [leaders, walletAddress]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-mono uppercase tracking-widest">Loading Leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-64 w-64 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-6xl px-6 py-10 md:px-10 h-full flex flex-col">
        <header className="mb-8 flex flex-col gap-6 border-b border-zinc-700 pb-6 lg:flex-row lg:items-end lg:justify-between shrink-0">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <Link href="/farm" className="hover:text-[var(--foreground)] transition-colors">Farm</Link>
              <span>/</span>
              <Link href="/marketplace" className="hover:text-[var(--foreground)] transition-colors">Marketplace</Link>
              <span>/</span>
              <span className="text-[var(--highlight)]">Leaderboard</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter md:text-6xl">GLOBAL LEADERBOARD</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)]">
              Ranked by total balance, then farm level and experience.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Wallet</div>
              <div className="font-mono text-sm text-[var(--highlight)]">{walletAddress ? shortWallet(walletAddress) : "Not connected"}</div>
            </div>
            <button
              onClick={() => void loadLeaderboard()}
              className="btn-game btn-game-blue"
              style={{ padding: "10px 12px", fontSize: "10px" }}
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="btn-game btn-game-red"
              style={{ padding: "10px 12px", fontSize: "10px" }}
            >
              Logout
            </button>
          </div>
        </header>

        {status && (
          <div className="mb-6 rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3 text-sm text-[var(--highlight)] shrink-0">
            {status}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-12 h-full overflow-y-auto custom-scrollbar pr-2 lg:overflow-hidden lg:pr-0">
            <section className="lg:col-span-4 space-y-4 lg:h-full lg:overflow-y-auto lg:custom-scrollbar lg:pr-2">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Players</div>
              <div className="mt-3 text-3xl font-black text-[var(--foreground)]">{totalPlayers}</div>
            </div>
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Top Balance</div>
              <div className="mt-3 text-3xl font-mono font-bold text-yellow-400">${topBalance}</div>
            </div>
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Your Rank</div>
              <div className="mt-3 text-3xl font-black text-[var(--foreground)]">{userRank ?? "-"}</div>
            </div>
          </section>

          <section className="lg:col-span-8 h-full">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] shadow-2xl overflow-hidden">
              <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[rgba(var(--panel-bg-rgb),0.9)] backdrop-blur">
                    <tr className="text-[10px] uppercase tracking-[0.35em] text-[var(--text-muted)]">
                      <th className="px-5 py-4">Rank</th>
                      <th className="px-5 py-4">Wallet</th>
                      <th className="px-5 py-4">Balance</th>
                      <th className="px-5 py-4">Level</th>
                      <th className="px-5 py-4">XP</th>
                      <th className="px-5 py-4">Farms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                          No leaderboard data available.
                        </td>
                      </tr>
                    )}
                    {leaders.map((leader, index) => {
                      const isSelf = walletAddress && leader.walletAddress.toLowerCase() === walletAddress.toLowerCase();
                      return (
                        <tr
                          key={leader.walletAddress}
                          className={`border-t border-zinc-700 ${isSelf ? "bg-emerald-500/10" : "hover:bg-[rgba(var(--panel-bg-rgb),0.7)]"}`}
                        >
                          <td className="px-5 py-4 text-[var(--text-muted)]">#{index + 1}</td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-black text-[var(--foreground)]">{leader.displayName}</div>
                            <div className="text-xs font-mono text-[var(--text-muted)]">{leader.walletAddress}</div>
                          </td>
                          <td className="px-5 py-4 text-yellow-300 font-mono font-bold">${leader.money}</td>
                          <td className="px-5 py-4 text-emerald-300 font-mono">{leader.maxLevel}</td>
                          <td className="px-5 py-4 text-amber-300 font-mono">{leader.totalXp}</td>
                          <td className="px-5 py-4 text-[var(--foreground)]">{leader.farmCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
          </div>
        </div>
      </main>
    </div>
  );
}
