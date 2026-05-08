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
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] p-6 md:p-12 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto h-full flex flex-col">
        <div className="mb-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[var(--foreground)] md:text-5xl">
              Engineering Bay
            </h1>
            <p className="mt-2 text-[var(--text-muted)]">
              Combine raw materials into powerful tools to boost your farm's productivity.
            </p>
          </div>
          <Link
            href="/farm"
            className="btn-game btn-game-dark"
            style={{ padding: "10px 14px", fontSize: "10px" }}
          >
            Back to Farm
          </Link>
        </div>

        {message && (
          <div className="mb-8 rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-6 py-4 text-[var(--highlight)] backdrop-blur-md animate-pulse shrink-0">
            {message}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-6">
          {CRAFTING_RECIPES.map((recipe) => {
            const outputConfig = CROPS[recipe.output.type];
            let canCraft = true;

            return (
              <div
                key={recipe.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 backdrop-blur-md transition-all hover:border-[var(--highlight)]"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[rgba(var(--panel-bg-rgb),0.9)] border border-[var(--game-border)] text-2xl">
                      {outputConfig?.emoji || "⚙️"}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
                        Produces
                      </div>
                      <div className="text-lg font-black text-[var(--foreground)]">
                        {recipe.output.amount}x {recipe.name}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--text-muted)] mb-4">{recipe.description}</p>
                  
                  <div className="mb-6 rounded-md bg-[rgba(var(--panel-bg-rgb),0.8)] p-3 text-xs text-[var(--accent-secondary)] border border-[var(--game-border)]">
                    {recipe.buffDescription}
                  </div>

                  <div className="mb-6">
                    <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3">
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
                            className="flex items-center justify-between rounded-md bg-[rgba(var(--panel-bg-rgb),0.8)] border border-[var(--game-border)] px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{ingConfig?.emoji}</span>
                              <span className="text-[var(--foreground)]">{ingConfig?.name || ing.type}</span>
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
                  className={`btn-game w-full ${
                    !canCraft || loading
                      ? "btn-game-dark"
                      : craftingId === recipe.id
                      ? "btn-game-yellow"
                      : "btn-game-green"
                  }`}
                  style={{ padding: "12px 12px", fontSize: "11px" }}
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
