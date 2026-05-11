"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";
import { useDisconnect } from "wagmi";

export default function SkillsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disconnectAsync } = useDisconnect();
  const [walletAddress, setWalletAddress] = useState("");
  const [level, setLevel] = useState(1);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
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

  const loadStatus = useCallback(async () => {
    try {
      const res = await walletFetch("/api/status");
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to load skills data");
        return;
      }

      setLevel(data.level ?? 1);
      const currentFarm = (data.farms || []).find((farm: any) => farm.regionId === data.currentRegion?.id) ?? (data.farms || [])[0] ?? null;
      setActiveFarmId(currentFarm?.id ?? null);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Failed to load skills data");
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
    void loadStatus();
  }, [walletAddress, loadStatus]);

  useEffect(() => {
    const forceFromQuery = searchParams.get("guide") === "1";
    const forceFromUnlock = activeFarmId
      ? localStorage.getItem(`chronofarm_skills_pending_guide_${activeFarmId}`) === "true"
      : false;

    if (forceFromQuery || forceFromUnlock) {
      if (activeFarmId) {
        localStorage.removeItem(`chronofarm_skills_pending_guide_${activeFarmId}`);
      }
      localStorage.removeItem("chronofarm_skills_tutorial_seen");
      setTutorialStep(1);

      if (forceFromQuery) {
        router.replace("/skills");
      }
    }
  }, [searchParams, router, activeFarmId]);

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

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050604] text-zinc-300">
        <div className="text-sm font-mono uppercase tracking-[0.3em] text-emerald-400">Loading Skills...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050604] text-zinc-100 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#12301d_0%,#050604_55%)] opacity-90" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="mb-8 flex items-center justify-between border-b border-emerald-900/40 pb-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-400">ChronoFarm Systems</div>
            <h1 className="mt-3 text-4xl font-black tracking-tighter md:text-6xl">SKILLS</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Choose how your farm evolves. Farm keeps you on the main land, Mining opens the resource route.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Level</div>
            <div className="mt-1 text-2xl font-black text-emerald-400">{level}</div>
          </div>
        </header>

        {status && (
          <div className="mb-6 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        )}

        {tutorialStep > 0 && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4">
            <div className="pointer-events-auto flex w-full max-w-lg flex-col gap-5 rounded-xl border border-emerald-500/50 bg-[#0a0f0a] p-6 text-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">SKILLS GUIDE</div>
              <div className="min-h-[3rem] text-sm leading-relaxed tracking-wide text-zinc-200">
                {tutorialStep === 1 && "This is the Skills menu. Pick a path based on how you want to play."}
                {tutorialStep === 2 && "Farm returns you to the main farm. Mining sends you to the mining page where you can build around resources."}
                {tutorialStep === 3 && "Use Skills whenever you want to switch between paths after level 4."}
              </div>
              <button
                className="btn-game btn-game-green self-center px-8 py-2 text-xs"
                onClick={() => {
                  if (tutorialStep === 3) {
                    setTutorialStep(0);
                    localStorage.setItem("chronofarm_skills_tutorial_seen", "true");
                  } else {
                    setTutorialStep(tutorialStep + 1);
                  }
                }}
              >
                {tutorialStep === 3 ? "START" : "NEXT"}
              </button>
            </div>
          </div>
        )}

        <main className="grid flex-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-emerald-900/40 bg-[rgba(9,15,10,0.88)] p-6 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Skill 01</div>
            <h2 className="mt-3 text-3xl font-black">FARM</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Return to the main farm to plant, harvest, and manage your crops.
            </p>
            <div className="mt-6">
              <Link href="/farm" className="btn-game btn-game-green inline-flex px-5 py-3 text-xs font-bold uppercase tracking-[0.2em]">
                Go to Farm
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-900/40 bg-[rgba(18,12,6,0.88)] p-6 shadow-2xl">
            <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Skill 02</div>
            <h2 className="mt-3 text-3xl font-black">MINING</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Open the mining page to gather ore, unlock materials, and expand your upgrades.
            </p>
            <div className="mt-6">
              <Link href="/mining" className="btn-game btn-game-yellow inline-flex px-5 py-3 text-xs font-bold uppercase tracking-[0.2em]">
                Go to Mining
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
