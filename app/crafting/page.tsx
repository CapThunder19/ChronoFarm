"use client";

import { useState, useEffect, useRef } from "react";
import { CRAFTING_RECIPES, CraftingRecipe } from "@/lib/crafting";
import { CROPS } from "@/lib/crops";
import { getStoredWalletAddress } from "@/lib/wallet-session";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hammer, ArrowLeft, Cpu, Hexagon, Component, Loader2, Sparkles, Box, Database, Activity, ShieldCheck, Target, Settings, ChevronLeft } from "lucide-react";

export default function CraftingPage() {
  const router = useRouter();
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [money, setMoney] = useState(0);
  const [level, setLevel] = useState(1);
  const [tickerItems, setTickerItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const walletAddress = getStoredWalletAddress();
      if (!walletAddress) {
        router.push("/");
        return;
      }
      const res = await fetch("/api/status", {
        headers: { "x-wallet-address": walletAddress },
      });
      if (!res.ok) return;

      const data = await res.json();
      const invMap: Record<string, number> = {};
      data.inventory?.forEach((item: any) => {
        invMap[item.cropType] = item.quantity;
      });
      setInventory(invMap);
      setMoney(data.money || 0);
      setLevel(data.level || 1);
      if (data.prices) setTickerItems(data.prices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCraft = async (recipe: CraftingRecipe) => {
    if (craftingId) return;

    setCraftingId(recipe.id);
    setMessage(`Initializing assembly protocol for ${recipe.name}...`);

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
          setMessage(`[SUCCESS] ${data.message}`);
          fetchStatus();
        } else {
          setMessage(`[ERROR] ${data.error}`);
        }
      } catch (err) {
        setMessage("[ERROR] Assembly failed due to network error.");
      } finally {
        setCraftingId(null);
        setTimeout(() => setMessage(null), 4000);
      }
    }, recipe.craftTime || 2000);
  };

  const featuredRecipe = CRAFTING_RECIPES[CRAFTING_RECIPES.length - 1]; 
  const regularRecipes = CRAFTING_RECIPES.filter(r => r.id !== featuredRecipe.id);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#050604] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--highlight)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#050604] text-[var(--foreground)] flex flex-col font-sans selection:bg-[var(--highlight)] selection:text-black overflow-hidden relative">
      
      {/* Background with overlay */}
      <div className="absolute inset-0 bg-[url('/landing-bg.png')] bg-cover bg-center bg-no-repeat opacity-40 mix-blend-overlay z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#050604]/80 to-[#050604] z-0 pointer-events-none" />

      {/* SYSTEM MESSAGE BANNER */}
      {message && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2 bg-[var(--panel-bg)] border border-[var(--highlight)] text-[var(--highlight)] text-xs font-bold tracking-widest uppercase rounded shadow-[0_0_15px_rgba(214,168,95,0.2)] animate-pulse flex items-center gap-2">
          {craftingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {message}
        </div>
      )}

      {/* 1. HEADER */}
      <header className="flex items-center justify-between px-8 py-6 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--highlight)] bg-[#1a1f1a] flex items-center justify-center shadow-[0_0_15px_rgba(214,168,95,0.2)]">
            <Settings className="w-6 h-6 text-[var(--highlight)]" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold tracking-widest text-zinc-100 drop-shadow-md">ENGINEERING BAY</h1>
            <p className="text-[11px] text-zinc-400 tracking-wider">Build machines. Power your farm.</p>
          </div>
        </div>
        
        <div className="hidden md:flex border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-full px-8 py-2.5 items-center gap-10 shadow-xl">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-zinc-500 tracking-[0.2em] uppercase mb-0.5">LEVEL</span>
            <div className="w-6 h-6 flex items-center justify-center border border-emerald-500/50 rounded-sm bg-emerald-900/20">
              <span className="text-emerald-400 font-bold text-xs">{level}</span>
            </div>
          </div>
          <div className="flex flex-col items-center border-l border-zinc-800 pl-10">
            <span className="text-[9px] text-zinc-500 tracking-[0.2em] uppercase mb-0.5">CREDITS</span>
            <span className="text-[var(--highlight)] font-bold text-sm flex items-center gap-1">
              🪙 ${money.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-zinc-800 pl-10">
            <span className="text-[9px] text-zinc-500 tracking-[0.2em] uppercase mb-0.5">STATUS</span>
            <span className={`font-bold text-sm ${craftingId ? "text-[var(--highlight)] animate-pulse" : "text-emerald-400"}`}>
              {craftingId ? "ASSEMBLING" : "IDLE"}
            </span>
          </div>
        </div>

        <Link href="/farm" className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] hover:bg-[#1a241b] backdrop-blur-md rounded px-5 py-2.5 text-[10px] font-bold tracking-[0.2em] text-[var(--highlight)] flex items-center gap-2 transition-all shadow-lg hover:shadow-[0_0_15px_rgba(214,168,95,0.2)]">
          <ChevronLeft className="w-4 h-4" /> RETURN TO FARM
        </Link>
      </header>

      {/* MIDDLE SECTION */}
      <div className="flex flex-1 overflow-hidden px-8 pb-4 gap-6 z-10">
        
        {/* 2. LEFT PANEL */}
        <aside className="w-64 flex flex-col gap-4 shrink-0">
          
          <div className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-xl p-5 shadow-xl">
            <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
              <Box className="w-4 h-4" /> STORAGE MATRIX
            </h2>
            <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-2">
              {Object.entries(inventory).filter(([_, qty]) => qty > 0).length === 0 ? (
                <div className="text-[10px] text-zinc-600 italic tracking-widest uppercase">No materials.</div>
              ) : (
                Object.entries(inventory).map(([type, qty]) => {
                  const cfg = CROPS[type] || { name: type, emoji: "📦" };
                  return (
                    <div key={type} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-lg filter drop-shadow-md">{cfg.emoji}</span>
                        <span className="text-zinc-300 capitalize tracking-wider">{cfg.name}</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-100">{qty}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-xl p-5 shadow-xl">
            <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
              <Database className="w-4 h-4" /> MATERIALS
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111a13] border border-zinc-800/80 p-3 text-center rounded-lg shadow-inner">
                <div className="text-2xl mb-1 filter drop-shadow-md">📦</div>
                <div className="text-[9px] text-zinc-500 tracking-widest mb-1">WOOD</div>
                <div className="text-zinc-200 font-mono font-bold">{inventory["WOOD"] || 0}</div>
              </div>
              <div className="bg-[#111a13] border border-zinc-800/80 p-3 text-center rounded-lg shadow-inner">
                <div className="text-2xl mb-1 filter drop-shadow-md">🪨</div>
                <div className="text-[9px] text-zinc-500 tracking-widest mb-1">IRON</div>
                <div className="text-zinc-200 font-mono font-bold">{inventory["IRON"] || 0}</div>
              </div>
            </div>
          </div>

          <div className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-xl p-5 shadow-xl flex-1 flex flex-col relative overflow-hidden">
            <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase mb-5 flex items-center gap-2 z-10">
              <Activity className="w-4 h-4" /> DIAGNOSTICS
            </h2>
            <div className="grid grid-cols-2 gap-4 text-xs z-10">
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] text-zinc-500 tracking-widest mb-2 uppercase">CAPACITY</span>
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 transform -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#111a13" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray="100, 100" className="drop-shadow-[0_0_4px_#34d399]" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-[11px] font-mono text-zinc-200">100%</div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span className="text-[9px] text-zinc-500 tracking-widest mb-2 uppercase">EFFICIENCY</span>
                <span className="text-emerald-400 font-bold tracking-widest mt-4">OPTIMAL</span>
              </div>
            </div>
            {/* Background decorative gear */}
            <div className="absolute -bottom-8 -right-8 opacity-[0.05] pointer-events-none">
              <Settings className="w-48 h-48" />
            </div>
          </div>

        </aside>

        {/* 3. MAIN CRAFTING AREA */}
        <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 relative pr-2">
          
          {/* Featured Recipe */}
          {featuredRecipe && (
            <div className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-xl overflow-hidden relative shadow-[0_0_30px_rgba(0,0,0,0.5)] shrink-0">
              <div className="flex flex-col lg:flex-row min-h-[300px]">
                
                {/* Left: Cinematic Image */}
                <div className="w-full lg:w-[40%] relative flex items-center justify-center overflow-hidden bg-[#050a06] border-b lg:border-b-0 lg:border-r border-zinc-800/50">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_70%)]" />
                  <div className="absolute bottom-10 w-48 h-12 bg-emerald-500/20 blur-2xl rounded-[100%]" />
                  <div className="absolute bottom-12 w-40 h-2 border-b-2 border-emerald-500/30 rounded-[100%] shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  
                  <div className="text-[120px] filter drop-shadow-[0_20px_20px_rgba(0,0,0,0.8)] z-10 transform hover:scale-105 transition-transform duration-700">
                    {CROPS[featuredRecipe.output.type]?.emoji || "🚜"}
                  </div>
                </div>

                {/* Middle: Details */}
                <div className="flex-1 p-8 flex flex-col justify-center">
                  <div className="text-[9px] font-bold tracking-[0.3em] text-[var(--highlight)] uppercase mb-2">PROTOTYPE SCHEMATIC</div>
                  <h2 className="text-4xl font-serif font-black text-zinc-100 mb-3 tracking-wide drop-shadow-md">{featuredRecipe.name}</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6 max-w-md">{featuredRecipe.description}</p>
                  
                  <div className="border border-emerald-900/40 bg-emerald-900/10 p-3 rounded flex items-center gap-3 w-fit">
                    <Sparkles className="w-4 h-4 text-[var(--highlight)]" />
                    <div>
                      <div className="text-[9px] text-[var(--highlight)] tracking-[0.2em] uppercase mb-0.5">PASSIVE ABILITY</div>
                      <div className="text-emerald-400 text-xs font-bold">{featuredRecipe.buffDescription}</div>
                    </div>
                  </div>
                </div>
                
                {/* Right: Requirements & Action */}
                <div className="w-full lg:w-72 bg-[rgba(0,0,0,0.3)] p-8 border-l border-zinc-800/50 flex flex-col">
                  <h3 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase mb-6">REQUIRED MATERIALS</h3>
                  
                  <div className="flex-1 space-y-4">
                    {featuredRecipe.ingredients.map(ing => {
                      const ingCfg = CROPS[ing.type];
                      const have = inventory[ing.type] || 0;
                      const hasEnough = have >= ing.amount;
                      return (
                        <div key={ing.type} className="flex justify-between items-center text-xs border-b border-zinc-800/50 pb-2">
                          <span className="text-zinc-400 flex items-center gap-2">
                            <span className="text-lg filter drop-shadow">{ingCfg?.emoji || "📦"}</span> {ingCfg?.name || ing.type}
                          </span>
                          <span className={hasEnough ? "text-emerald-400 font-mono font-bold" : "text-red-500 font-mono font-bold"}>{have} / {ing.amount}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handleCraft(featuredRecipe)}
                    disabled={featuredRecipe.ingredients.some(ing => (inventory[ing.type] || 0) < ing.amount) || !!craftingId || loading}
                    className="w-full py-4 mt-6 bg-gradient-to-b from-[#d6a85f] to-[#b98646] hover:from-[#e6bf7c] hover:to-[#c99656] disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 disabled:border-zinc-700 text-black border border-[#f0d092] text-xs font-black tracking-[0.2em] uppercase rounded transition-all shadow-[0_0_20px_rgba(214,168,95,0.3)] disabled:shadow-none flex items-center justify-center gap-2 relative overflow-hidden"
                  >
                    <Hammer className="w-4 h-4" />
                    {craftingId === featuredRecipe.id ? "ASSEMBLING..." : "INITIALIZE BUILD"}
                    {craftingId === featuredRecipe.id && (
                      <div className="absolute bottom-0 left-0 h-1 bg-white/50" style={{ animation: `progress ${featuredRecipe.craftTime}ms linear forwards` }} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section Divider */}
          <div className="flex items-center gap-4 my-2 opacity-80">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--game-border)]" />
            <Settings className="w-4 h-4 text-[var(--highlight)]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--highlight)] uppercase">STANDARD SCHEMATICS</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--game-border)]" />
          </div>

          {/* Standard Recipes Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
            {regularRecipes.map(recipe => {
              const outCfg = CROPS[recipe.output.type];
              let canCraft = true;
              
              return (
                <div key={recipe.id} className="border border-[var(--game-border)] bg-[rgba(16,24,20,0.8)] backdrop-blur-md rounded-xl p-6 flex flex-col justify-between hover:border-[var(--highlight)] transition-colors shadow-lg group">
                  <div>
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-20 h-20 rounded border border-[var(--game-border)] bg-[#111a13] flex items-center justify-center text-5xl shadow-inner group-hover:shadow-[inset_0_0_20px_rgba(214,168,95,0.1)] transition-shadow">
                        <span className="filter drop-shadow-lg">{outCfg?.emoji}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase mb-1">YIELD</div>
                        <div className="font-bold text-emerald-400 text-lg font-serif">{recipe.output.amount}x</div>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-serif font-bold text-zinc-100 mb-2">{recipe.output.amount}x {recipe.name}</h3>
                    <p className="text-xs text-zinc-400 mb-6 min-h-[40px] leading-relaxed">{recipe.description}</p>
                    
                    <div className="space-y-2 mb-6 border-t border-zinc-800/50 pt-4">
                      {recipe.ingredients.map(ing => {
                        const ingCfg = CROPS[ing.type];
                        const have = inventory[ing.type] || 0;
                        const hasEnough = have >= ing.amount;
                        if (!hasEnough) canCraft = false;
                        return (
                          <div key={ing.type} className="flex justify-between items-center text-xs">
                            <span className="text-zinc-400 flex items-center gap-2">
                              <span className="text-base filter drop-shadow">{ingCfg?.emoji}</span> {ingCfg?.name || ing.type}
                            </span>
                            <span className={hasEnough ? "text-emerald-400 font-mono font-bold" : "text-red-500 font-mono font-bold"}>{have} / {ing.amount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCraft(recipe)}
                    disabled={!canCraft || !!craftingId || loading}
                    className="w-full py-3.5 bg-gradient-to-b from-[#2aa86a] to-[#1f7b4e] hover:from-[#39d98a] hover:to-[#2aa86a] disabled:from-[#111a13] disabled:to-[#16241b] disabled:text-zinc-600 border border-[#39d98a] disabled:border-zinc-800 text-[#050a06] text-[11px] font-black tracking-[0.2em] uppercase rounded transition-all shadow-[0_0_15px_rgba(42,168,106,0.3)] disabled:shadow-none flex justify-center items-center gap-2 relative overflow-hidden"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    {craftingId === recipe.id ? "ASSEMBLING..." : "CRAFT"}
                    {craftingId === recipe.id && (
                      <div className="absolute bottom-0 left-0 h-1 bg-white/50" style={{ animation: `progress ${recipe.craftTime}ms linear forwards` }} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Animated Forge visual */}
          <div className="mt-4 pt-10 pb-6 border-t border-zinc-800/30 flex flex-col items-center justify-center shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              <div className={`absolute inset-0 border-2 rounded-full border-dashed ${craftingId ? 'border-[var(--highlight)] animate-spin-slow shadow-[0_0_20px_rgba(214,168,95,0.4)]' : 'border-[var(--game-border)] animate-spin-slow'}`} style={{animationDuration: '8s'}} />
              <div className={`absolute inset-2 border border-dashed rounded-full ${craftingId ? 'border-[var(--highlight)] opacity-50 animate-reverse-spin' : 'border-[var(--game-border)] animate-reverse-spin'}`} style={{animationDuration: '12s'}} />
              <Target className={`w-6 h-6 ${craftingId ? 'text-[var(--highlight)] animate-pulse' : 'text-zinc-600'}`} />
            </div>
            <span className={`text-[10px] tracking-[0.2em] uppercase font-bold mb-1 ${craftingId ? 'text-[var(--highlight)]' : 'text-zinc-400'}`}>
              {craftingId ? 'ASSEMBLY CORE ACTIVE' : 'ASSEMBLY CORE STANDBY'}
            </span>
            <span className="text-[10px] text-zinc-500 tracking-wider">All systems nominal. Awaiting schematics.</span>
          </div>

        </main>
      </div>

      {/* 4. BOTTOM RESOURCE TICKER */}
      <div className="h-10 border-t border-[var(--game-border)] bg-[#050604] flex items-center overflow-hidden shrink-0 z-10 relative">
        <div className="flex animate-ticker whitespace-nowrap">
          {tickerItems.length > 0 ? (
            [...tickerItems, ...tickerItems, ...tickerItems].map((price, idx) => {
              const cfg = CROPS[price.cropType];
              return (
                <span key={idx} className="mx-8 text-[10px] tracking-widest flex items-center gap-2">
                  <span className="text-lg drop-shadow">{cfg?.emoji}</span>
                  <span className="text-zinc-400 capitalize mr-1">{cfg?.name || price.cropType}:</span>
                  <span className="text-[var(--highlight)] font-mono font-bold">${price.price}</span>
                </span>
              );
            })
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] tracking-widest px-8">CONNECTING TO GLOBAL MARKET EXCHANGE...</span>
          )}
        </div>
      </div>



      <style jsx global>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-ticker {
          animation: ticker 40s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        .animate-reverse-spin {
          animation: spin 12s linear infinite reverse;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 90, 43, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 90, 43, 0.5);
        }
      `}</style>
    </div>
  );
}
