"use client";

import { useState, useEffect } from "react";
import { CRAFTING_RECIPES, CraftingRecipe } from "@/lib/crafting";
import { CROPS } from "@/lib/crops";
import { getStoredWalletAddress } from "@/lib/wallet-session";
import Link from "next/link";

export default function CraftingPage() {
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchInventory = async () => {
    try {
      const walletAddress = getStoredWalletAddress();
      if (!walletAddress) return;

      const res = await fetch("/api/inventory", {
        headers: { "x-wallet-address": walletAddress },
      });
      if (!res.ok) return;

      const data = await res.json();
      const invMap: Record<string, number> = {};
      data.forEach((item: any) => {
        invMap[item.cropType] = item.quantity;
      });
      setInventory(invMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleCraft = async (recipe: CraftingRecipe) => {
    if (craftingId) return;

    // Simulate crafting time for UX
    setCraftingId(recipe.id);
    setMessage(`Crafting ${recipe.name}...`);

    setTimeout(async () => {
      try {
        const walletAddress = getStoredWalletAddress();
        const res = await fetch("/api/craft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-wallet-address": walletAddress || "",
          },
          body: JSON.stringify({ recipeId: recipe.id }),
        });

        const data = await res.json();

        if (res.ok) {
          setMessage(data.message);
          fetchInventory(); // refresh inventory
        } else {
          setMessage(data.error);
        }
      } catch (err) {
        setMessage("Crafting failed due to network error.");
      } finally {
        setCraftingId(null);
        setTimeout(() => setMessage(null), 3000);
      }
    }, recipe.craftTime || 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-6 md:p-12 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-lime-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
              Engineering Bay
            </h1>
            <p className="mt-2 text-zinc-400">
              Combine raw materials into powerful tools to boost your farm's productivity.
            </p>
          </div>
          <Link
            href="/farm"
            className="rounded-full bg-zinc-900/80 px-6 py-3 text-sm font-bold border border-zinc-800 transition hover:bg-zinc-800 hover:border-zinc-700"
          >
            Back to Farm
          </Link>
        </div>

        {message && (
          <div className="mb-8 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-4 text-cyan-200 backdrop-blur-md animate-pulse">
            {message}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CRAFTING_RECIPES.map((recipe) => {
            const outputConfig = CROPS[recipe.output.type];
            let canCraft = true;

            return (
              <div
                key={recipe.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60 p-6 backdrop-blur-md transition-all hover:border-zinc-700"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-2xl">
                      {outputConfig?.emoji || "⚙️"}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                        Produces
                      </div>
                      <div className="text-lg font-black text-white">
                        {recipe.output.amount}x {recipe.name}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 mb-4">{recipe.description}</p>
                  
                  <div className="mb-6 rounded-xl bg-zinc-900/50 p-3 text-xs text-lime-400 border border-lime-500/20">
                    {recipe.buffDescription}
                  </div>

                  <div className="mb-6">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
                      Requirements
                    </div>
                    <div className="grid gap-2">
                      {recipe.ingredients.map((ing) => {
                        const ingConfig = CROPS[ing.type];
                        const have = inventory[ing.type] || 0;
                        const hasEnough = have >= ing.amount;
                        if (!hasEnough) canCraft = false;

                        return (
                          <div
                            key={ing.type}
                            className="flex items-center justify-between rounded-lg bg-zinc-900/80 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{ingConfig?.emoji}</span>
                              <span className="text-zinc-300">{ingConfig?.name || ing.type}</span>
                            </div>
                            <div
                              className={`font-mono ${
                                hasEnough ? "text-cyan-400" : "text-red-400"
                              }`}
                            >
                              {have} / {ing.amount}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleCraft(recipe)}
                  disabled={!canCraft || !!craftingId || loading}
                  className={`relative w-full overflow-hidden rounded-2xl px-4 py-4 font-bold transition-all ${
                    !canCraft || loading
                      ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                      : craftingId === recipe.id
                      ? "bg-amber-500 text-black"
                      : "bg-cyan-500 text-black hover:bg-cyan-400 active:scale-[0.98]"
                  }`}
                >
                  {craftingId === recipe.id ? (
                    <span className="flex items-center justify-center gap-2 animate-pulse">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Constructing...
                    </span>
                  ) : (
                    "Assemble"
                  )}
                  {craftingId === recipe.id && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-black/20"
                      style={{ 
                        animation: `progress ${recipe.craftTime}ms linear forwards` 
                      }}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <style jsx global>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
