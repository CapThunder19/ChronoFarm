"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CROPS } from "@/lib/crops";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { disconnectAsync } = useDisconnect();
  const [money, setMoney] = useState(0);
  const [level, setLevel] = useState(1);
  const [year, setYear] = useState(1910);
  const [event, setEvent] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [npcs, setNpcs] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [tutorialStep, setTutorialStep] = useState(0);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);

  // Auto-open guide when player is redirected here after first reaching level 2.
  useEffect(() => {
    const forceFromQuery = searchParams.get("guide") === "1";
    const forceFromUnlock = activeFarmId
      ? localStorage.getItem(`chronofarm_marketplace_pending_guide_${activeFarmId}`) === "true"
      : false;

    if (forceFromQuery || forceFromUnlock) {
      if (activeFarmId) {
        localStorage.removeItem(`chronofarm_marketplace_pending_guide_${activeFarmId}`);
      }
      localStorage.removeItem("chronofarm_marketplace_tutorial_seen");
      setTutorialStep(1);

      if (forceFromQuery) {
        router.replace("/marketplace");
      }
    }
  }, [searchParams, router, activeFarmId]);

  const statusInFlight = useRef(false);
  const marketsInFlight = useRef(false);

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

  const loadMarketData = useCallback(async () => {
    if (statusInFlight.current) return;
    statusInFlight.current = true;
    try {
      const res = await walletFetch("/api/status");
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Failed to load"); return; }
      setMoney(data.money);
      setLevel(data.level ?? 1);
      setYear(data.year);
      setEvent(data.event);
      setInventory(data.inventory);
      setRegions(data.regions || []);
      setCurrentRegion(data.currentRegion);
      const currentFarm = (data.farms || []).find((farm: any) => farm.regionId === data.currentRegion?.id) ?? (data.farms || [])[0] ?? null;
      setActiveFarmId(currentFarm?.id ?? null);
    } catch (err) {
      console.error("Failed to load marketplace data", err);
    } finally {
      statusInFlight.current = false;
    }
  }, [walletFetch]);

  const loadAllMarkets = useCallback(async () => {
    if (marketsInFlight.current) return;
    marketsInFlight.current = true;
    try {
      const res = await walletFetch("/api/markets");
      const data = await res.json();
      setNpcs(data.npcs || []);
      setMarketPrices(data.prices || []);
    } catch (err) {
      console.error("Failed to load markets", err);
    } finally {
      marketsInFlight.current = false;
    }
  }, [walletFetch]);

  useEffect(() => {
    const wallet = getStoredWalletAddress();
    if (!wallet) { router.push("/"); return; }
    setWalletAddress(wallet);
  }, [router]);

  useEffect(() => {
    if (!walletAddress) return;

    // Initial load
    Promise.all([loadMarketData(), loadAllMarkets()]).finally(() => setIsLoading(false));

    // Poll every 5s for status (balance, inventory, event)
    const statusInterval = setInterval(() => { void loadMarketData(); }, 5000);
    // Poll every 30s for market prices (they change slowly)
    const marketsInterval = setInterval(() => { void loadAllMarkets(); }, 30000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(marketsInterval);
    };
  }, [walletAddress, loadMarketData, loadAllMarkets]);

  useEffect(() => {
    if (isLoading) return;
    if (level < 2) {
      router.push("/farm");
    }
  }, [isLoading, level, router]);

  const handleLogout = async () => {
    try { await disconnectAsync(); } catch {}
    finally { clearWalletSession(); router.push("/"); }
  };

  // ——— BUY with optimistic update ———
  const handleBuy = async (price: any, region: any, qty: number = 1) => {
    const actionKey = `buy-${price.cropType}-${region.id}`;
    if (pendingActions.has(actionKey)) return;

    // Optimistic: deduct money and increment inventory immediately
    setMoney(prev => prev - (price.price * qty));
    setInventory(prev => {
      const existing = prev.find(i => i.cropType === price.cropType);
      if (existing) {
        return prev.map(i => i.cropType === price.cropType ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { id: `temp-${price.cropType}`, cropType: price.cropType, quantity: qty }];
    });
    // Optimistic: reduce supply in market
    setMarketPrices(prev => prev.map(p =>
      p.id === price.id ? { ...p, supply: Math.max(0, p.supply - qty), demand: p.demand + qty } : p
    ));

    setPendingActions(prev => new Set(prev).add(actionKey));
    try {
      const res = await walletFetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropType: price.cropType, quantity: qty, regionId: region.id }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      if (res.ok) {
        setQuantities(prev => ({ ...prev, [price.id]: 1 }));
      } else {
        // Revert on failure
        void loadMarketData();
        void loadAllMarkets();
      }
    } catch {
      void loadMarketData();
      void loadAllMarkets();
    } finally {
      setPendingActions(prev => { const s = new Set(prev); s.delete(actionKey); return s; });
    }
  };

  // ——— SELL with optimistic update ———
  const sellCropToRegion = async (cropType: string, regionId: string, salePrice: number, qty: number = 1) => {
    const actionKey = `sell-${cropType}-${regionId}`;
    if (pendingActions.has(actionKey)) return;

    // Optimistic: add money, decrement inventory
    setMoney(prev => prev + (salePrice * qty));
    setInventory(prev => prev
      .map(i => i.cropType === cropType ? { ...i, quantity: i.quantity - qty } : i)
      .filter(i => i.quantity > 0)
    );
    setMarketPrices(prev => prev.map(p =>
      p.cropType === cropType && p.regionId === regionId ? { ...p, supply: p.supply + qty } : p
    ));

    setPendingActions(prev => new Set(prev).add(actionKey));
    try {
      const res = await walletFetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropType, quantity: qty, regionId }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      if (res.ok) {
        setQuantities(prev => {
          const matchingPrice = marketPrices.find(p => p.cropType === cropType && p.regionId === regionId);
          if (matchingPrice) {
            return { ...prev, [matchingPrice.id]: 1 };
          }
          return prev;
        });
      } else {
        void loadMarketData();
        void loadAllMarkets();
      }
    } catch {
      void loadMarketData();
      void loadAllMarkets();
    } finally {
      setPendingActions(prev => { const s = new Set(prev); s.delete(actionKey); return s; });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-mono uppercase tracking-widest">Loading Exchange...</p>
        </div>
      </div>
    );
  }

  const enrichedPrices = marketPrices.map(price => {
    const region = regions.find(r => r.id === price.regionId);
    const inStock = inventory.find(i => i.cropType === price.cropType)?.quantity || 0;
    const isHighDemand = event?.effects?.demand?.includes(price.cropType) && (event?.regions?.includes(region?.name) || !event?.regions);
    const isLocal = region?.id === currentRegion?.id;
    return { price, region, inStock, isHighDemand, isLocal };
  });

  const filteredPrices = enrichedPrices.filter(({ inStock, isHighDemand, isLocal }) => {
    if (activeFilter === "local") return isLocal;
    if (activeFilter === "hot") return isHighDemand;
    if (activeFilter === "stock") return inStock > 0;
    return true;
  });

  return (
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] p-4 md:p-6 overflow-hidden flex flex-col gap-4 font-mono">
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker { display: flex; width: max-content; animation: ticker 180s linear infinite; }
      `}</style>

      {/* TOP HUD */}
      <header className="flex justify-between items-center p-4 bg-[rgba(var(--panel-bg-rgb),0.85)] border border-[var(--game-border)] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] rounded-lg shrink-0">
        <div className="flex flex-wrap items-center gap-4 md:gap-8">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Region</span>
            <span className="text-sm font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded border border-blue-500/30">{currentRegion?.name || "Global"}</span>
          </div>
          <div className="h-6 w-[1px] bg-[var(--game-border)] opacity-50 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Balance</span>
            <span className="text-sm font-bold text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-500/30">💰 ${money}</span>
          </div>
          <div className="h-6 w-[1px] bg-[var(--game-border)] opacity-50 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Timeline</span>
            <span className="text-sm font-bold text-[var(--foreground)] bg-zinc-800/50 px-2 py-1 rounded border border-zinc-600/50">📅 {year}</span>
          </div>
          <div className="h-6 w-[1px] bg-[var(--game-border)] opacity-50 hidden md:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Event</span>
            {event ? (
              <span className="text-sm font-bold text-red-400 bg-red-900/30 px-2 py-1 rounded border border-red-500/30 animate-pulse">{event.name}</span>
            ) : (
              <span className="text-sm font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded border border-green-500/30">None</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Wallet Connected</span>
              <span className="text-xs text-[var(--accent-primary)]">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </div>
            <button onClick={handleLogout} className="btn-game btn-game-red !text-[10px] !px-2 !py-1">Disc</button>
          </div>
          <button
            title="Open marketplace guide"
            onClick={() => {
              // Reset tutorial and show from step 1
              localStorage.removeItem("chronofarm_marketplace_tutorial_seen");
              setTutorialStep(1);
            }}
            className="border border-[var(--game-border)] bg-[rgba(0,0,0,0.4)] text-[var(--foreground)] px-3 py-1 rounded text-xs"
          >
            ? Guide
          </button>
          <div className="h-6 w-[1px] bg-[var(--game-border)] opacity-50 hidden md:block"></div>
          <Link href="/farm" className="btn-game btn-game-indigo !text-xs">Farm Return</Link>
        </div>
      </header>

      {message && (
        <div className="p-3 bg-blue-900/40 border border-blue-500/50 rounded-lg text-blue-200 text-xs font-mono shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          {">"} {message}
        </div>
      )}

      {/* TUTORIAL OVERLAY */}
      {tutorialStep > 0 && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center transition-opacity pointer-events-none">
          <div className="bg-[#0a0f0a] border border-emerald-500/50 p-6 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] max-w-lg w-full text-center flex flex-col gap-5 pointer-events-auto">
            <div className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-xs flex items-center justify-center gap-2">
              MARKETPLACE GUIDE
            </div>
            <div className="text-zinc-200 text-sm leading-relaxed tracking-wide min-h-[3rem]">
              {tutorialStep === 1 && "Welcome to the Global Exchange! This is where you can buy and sell crops across the world."}
              {tutorialStep === 2 && "Market prices fluctuate wildly based on Supply, Demand, and Global Events. Since we are in 'The Titanic Era', Wheat and Potatoes are selling for a huge premium!"}
              {tutorialStep === 3 && "Check your Inventory on the left. Use the BUY and SELL buttons in the Resource Grid to execute trades. Buy low, sell high, and become a farming tycoon!"}
            </div>
            <button className="btn-game btn-game-green self-center text-xs px-8 py-2" onClick={() => {
              if (tutorialStep === 3) {
                setTutorialStep(0);
                localStorage.setItem("chronofarm_marketplace_tutorial_seen", "true");
              } else {
                setTutorialStep(tutorialStep + 1);
              }
            }}>
              {tutorialStep === 3 ? "START TRADING" : "NEXT"}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        
        {/* LEFT PANEL */}
        <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar">
          {/* Inventory / Warehouse */}
          <div className="p-4 bg-[rgba(var(--panel-bg-rgb),0.85)] rounded-lg border border-[var(--game-border)] shadow-xl flex-1 flex flex-col min-h-[250px]">
             <h3 className="text-[10px] font-black text-[var(--highlight)] uppercase tracking-[0.3em] mb-3 border-b border-[var(--game-border)] pb-2 flex justify-between">
               <span>Inventory</span>
               <span>Warehouse</span>
             </h3>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
               {inventory.length === 0 ? (
                 <div className="py-8 text-center text-[var(--text-muted)] text-xs italic opacity-50">Empty Space</div>
               ) : (
                 inventory.map((item) => (
                   <div key={item.id} className="flex items-center justify-between p-2 bg-[rgba(0,0,0,0.2)] rounded border border-[var(--game-border)]">
                     <div className="flex items-center gap-2">
                       <span className="text-lg">{CROPS[item.cropType]?.emoji}</span>
                       <span className="text-xs text-[var(--text-muted)] uppercase">{item.cropType}</span>
                     </div>
                     <span className="text-sm font-bold text-[var(--foreground)]">{item.quantity}</span>
                   </div>
                 ))
               )}
             </div>
          </div>

          {/* Filters */}
          <div className="p-4 bg-[rgba(var(--panel-bg-rgb),0.85)] rounded-lg border border-[var(--game-border)] shadow-xl shrink-0">
             <h3 className="text-[10px] font-black text-[var(--highlight)] uppercase tracking-[0.3em] mb-3 border-b border-[var(--game-border)] pb-2">Filters</h3>
             <div className="grid grid-cols-2 gap-2">
               <button onClick={() => setActiveFilter("all")} className={`btn-game ${activeFilter === "all" ? "btn-game-blue" : "btn-game-dark"} !text-[9px] !py-1.5`}>All Regions</button>
               <button onClick={() => setActiveFilter("local")} className={`btn-game ${activeFilter === "local" ? "btn-game-blue" : "btn-game-dark"} !text-[9px] !py-1.5`}>Local Only</button>
               <button onClick={() => setActiveFilter("hot")} className={`btn-game ${activeFilter === "hot" ? "btn-game-blue" : "btn-game-dark"} !text-[9px] !py-1.5`}>High Demand</button>
               <button onClick={() => setActiveFilter("stock")} className={`btn-game ${activeFilter === "stock" ? "btn-game-blue" : "btn-game-dark"} !text-[9px] !py-1.5`}>My Stock</button>
             </div>
          </div>

          {/* Dealer List */}
          <div className="p-4 bg-[rgba(var(--panel-bg-rgb),0.85)] rounded-lg border border-[var(--game-border)] shadow-xl flex-1 flex flex-col min-h-[200px]">
             <h3 className="text-[10px] font-black text-[var(--highlight)] uppercase tracking-[0.3em] mb-3 border-b border-[var(--game-border)] pb-2">Dealer List</h3>
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {npcs.map(npc => {
                  const r = regions.find(x => x.id === npc.regionId);
                  return (
                    <div key={npc.id} className="p-2 bg-[rgba(0,0,0,0.2)] rounded border border-zinc-700/50 flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[var(--foreground)]">🏛️ {npc.name}</span>
                        <span className="text-[8px] text-blue-400 bg-blue-900/20 px-1 py-0.5 rounded">{r?.continent?.substring(0,3) || "UNK"}</span>
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] truncate">{r?.name}</span>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>

        {/* MAIN MARKETPLACE */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          
          {/* Featured Market Banner */}
          {event && (
            <div className="p-5 bg-amber-950/60 border border-amber-500/50 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 shadow-[0_4px_20px_rgba(217,119,6,0.15)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl">📢</div>
              <div className="flex flex-col z-10">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1 drop-shadow-md">Featured Market Banner</span>
                <h2 className="text-xl md:text-2xl font-black text-amber-100 uppercase">{event.name}</h2>
                <p className="text-xs text-amber-200/80 mt-1 max-w-lg italic">"{event.dialogue}"</p>
              </div>
              <div className="mt-4 md:mt-0 text-left md:text-right z-10 flex flex-row md:flex-col gap-4 md:gap-1 items-center md:items-end">
                <span className="text-[10px] text-amber-400 uppercase tracking-widest block">Global Price Impact</span>
                <span className="text-2xl font-mono font-bold text-amber-300 bg-amber-900/40 px-3 py-1 rounded border border-amber-500/30">
                  x{event.effects?.priceMultiplier || 1.0}
                </span>
              </div>
            </div>
          )}

          {/* Resource Grid / Buy Sell Cards */}
          <div className="flex-1 p-4 bg-[rgba(var(--panel-bg-rgb),0.7)] rounded-lg border border-[var(--game-border)] shadow-xl flex flex-col overflow-hidden">
             <div className="flex justify-between items-center mb-4 border-b border-[var(--game-border)] pb-2 shrink-0">
               <h3 className="text-[10px] font-black text-[var(--highlight)] uppercase tracking-[0.3em]">Resource Grid (Buy/Sell Cards)</h3>
               <span className="text-[10px] text-[var(--text-muted)]">{filteredPrices.length} Active Listings</span>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
                  {filteredPrices.map(({ price, region, inStock, isHighDemand, isLocal }) => {
                    const buyKey = `buy-${price.cropType}-${price.regionId}`;
                    const sellKey = `sell-${price.cropType}-${price.regionId}`;
                    const isBuying = pendingActions.has(buyKey);
                    const isSelling = pendingActions.has(sellKey);
                    
                    const cropDef = CROPS[price.cropType as keyof typeof CROPS];
                    const isCrafted = cropDef?.itemType === "crafted";
                    const isRare = (cropDef?.unlockLevel || 1) >= 4;
                    const continent = region?.continent || "";

                    let themeColor = "";
                    let shadowColor = "";
                    let tagColor = "";
                    let rarityLabel = "";

                    if (isCrafted) {
                      themeColor = "bg-gradient-to-br from-purple-900/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-purple-500/80 border-t-[4px] border-t-purple-400";
                      shadowColor = "shadow-[0_8px_20px_rgba(168,85,247,0.25)] hover:shadow-[0_8px_25px_rgba(168,85,247,0.4)]";
                      tagColor = "text-purple-100 bg-purple-700/80 border-purple-400 font-black shadow-[0_0_8px_rgba(168,85,247,0.6)]";
                      rarityLabel = "Crafted";
                    } else if (isRare) {
                      themeColor = "bg-gradient-to-br from-amber-900/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-amber-500/80 border-t-[4px] border-t-amber-400";
                      shadowColor = "shadow-[0_8px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.4)]";
                      tagColor = "text-amber-100 bg-amber-700/80 border-amber-400 font-black shadow-[0_0_8px_rgba(245,158,11,0.6)]";
                      rarityLabel = "Rare Crop";
                    } else if (isLocal) {
                      themeColor = "bg-gradient-to-br from-green-900/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-green-500/80 border-t-[4px] border-t-green-400";
                      shadowColor = "shadow-[0_8px_20px_rgba(34,197,94,0.25)] hover:shadow-[0_8px_25px_rgba(34,197,94,0.4)]";
                      tagColor = "text-green-100 bg-green-700/80 border-green-400 font-black shadow-[0_0_8px_rgba(34,197,94,0.6)]";
                      rarityLabel = "Local Crop";
                    } else if (continent === "Asia") {
                      themeColor = "bg-gradient-to-br from-pink-900/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-pink-500/80 border-t-[4px] border-t-pink-400";
                      shadowColor = "shadow-[0_8px_20px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_25px_rgba(236,72,153,0.4)]";
                      tagColor = "text-pink-100 bg-pink-700/80 border-pink-400 font-black shadow-[0_0_8px_rgba(236,72,153,0.6)]";
                      rarityLabel = "Asia Import";
                    } else if (continent === "Americas") {
                      themeColor = "bg-gradient-to-br from-blue-900/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-blue-500/80 border-t-[4px] border-t-blue-400";
                      shadowColor = "shadow-[0_8px_20px_rgba(59,130,246,0.25)] hover:shadow-[0_8px_25px_rgba(59,130,246,0.4)]";
                      tagColor = "text-blue-100 bg-blue-700/80 border-blue-400 font-black shadow-[0_0_8px_rgba(59,130,246,0.6)]";
                      rarityLabel = "Americas Import";
                    } else {
                      themeColor = "bg-gradient-to-br from-zinc-800/60 to-[rgba(var(--panel-bg-rgb),0.9)] border-zinc-500/80 border-t-[4px] border-t-zinc-300";
                      shadowColor = "shadow-[0_8px_20px_rgba(161,161,170,0.2)] hover:shadow-[0_8px_25px_rgba(161,161,170,0.3)]";
                      tagColor = "text-zinc-100 bg-zinc-700/80 border-zinc-400 font-black shadow-[0_0_8px_rgba(161,161,170,0.6)]";
                      rarityLabel = "Global Import";
                    }

                    if (isHighDemand) {
                       shadowColor += " !shadow-[0_0_20px_rgba(239,68,68,0.5)] border-red-500/60";
                    }

                    return (
                      <div key={price.id} className={`flex flex-col p-4 rounded-xl border transition-all duration-300 hover:-translate-y-1 ${themeColor} ${shadowColor} backdrop-blur-md relative overflow-hidden group`}>
                        
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity"></div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300 origin-center">{cropDef?.emoji || "📦"}</span>
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-white uppercase tracking-wider drop-shadow-md">{price.cropType}</span>
                              <div className="flex items-center gap-1 mt-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded shadow-sm border ${tagColor}`}>
                                  {rarityLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-2xl font-mono font-black text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">${price.price}</span>
                            {isHighDemand && <span className="text-[10px] font-black text-red-50 uppercase bg-red-600 px-1.5 py-0.5 rounded border border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse mt-1">🔥 Surge</span>}
                          </div>
                        </div>

                        <div className="space-y-3 mt-auto relative z-10">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-300 drop-shadow-md">
                            <span className="text-cyan-300">S: {price.supply}</span>
                            <span className="text-orange-400">D: {price.demand}</span>
                          </div>
                          <div className="h-2 bg-zinc-950/80 rounded-full overflow-hidden flex border border-black shadow-inner">
                            <div className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-1000" style={{ width: `${(price.supply / Math.max(1, price.supply + price.demand)) * 100}%` }}></div>
                            <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] transition-all duration-1000" style={{ width: `${(price.demand / Math.max(1, price.supply + price.demand)) * 100}%` }}></div>
                          </div>

                          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                            <div className="flex justify-between items-center bg-black/40 rounded border border-white/5 p-1 mb-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]">
                              <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest pl-2">Quantity</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setQuantities(prev => ({ ...prev, [price.id]: Math.max(1, (prev[price.id] || 1) - 1)}))} disabled={(quantities[price.id] || 1) <= 1} className="w-5 h-5 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white rounded border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">-</button>
                                <span className="text-xs font-mono font-bold w-6 text-center text-white drop-shadow-md">{quantities[price.id] || 1}</span>
                                <button onClick={() => setQuantities(prev => ({ ...prev, [price.id]: (prev[price.id] || 1) + 1}))} className="w-5 h-5 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white rounded border border-zinc-700 transition-colors cursor-pointer">+</button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <button
                                disabled={money < (price.price * (quantities[price.id] || 1)) || isBuying}
                                onClick={() => handleBuy(price, region, quantities[price.id] || 1)}
                                className={`btn-game ${money >= (price.price * (quantities[price.id] || 1)) && !isBuying ? "btn-game-blue" : "btn-game-dark"} !text-[10px] !px-1 !py-2`}
                              >
                                {isBuying ? "..." : `Buy ($${price.price * (quantities[price.id] || 1)})`}
                              </button>

                              <button
                                disabled={inStock < (quantities[price.id] || 1) || isSelling}
                                onClick={() => sellCropToRegion(price.cropType, price.regionId, price.price, quantities[price.id] || 1)}
                                className={`btn-game ${inStock >= (quantities[price.id] || 1) && !isSelling ? "btn-game-yellow" : "btn-game-dark"} !text-[10px] !px-1 !py-2`}
                              >
                                {isSelling ? "..." : inStock >= (quantities[price.id] || 1) ? `Sell ${quantities[price.id] || 1}` : "No Stock"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
             </div>
          </div>
        </div>

      </div>

      {/* Bottom Live Trade Feed / Global Prices */}
      <div className="h-8 bg-[#0a0f0c] border border-[var(--game-border)] rounded shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] flex items-center shrink-0 relative overflow-hidden">
         <div className="absolute left-0 top-0 bottom-0 bg-[#0a0f0c] z-10 px-3 flex items-center border-r border-[var(--game-border)] shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
           <span className="text-[9px] font-black text-green-400 uppercase tracking-widest flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
             Live Trade Feed
           </span>
         </div>
         <div className="flex-1 overflow-hidden ml-32">
           <div className="animate-ticker flex items-center">
             {marketPrices.length > 0 ? (
               [...marketPrices, ...marketPrices, ...marketPrices, ...marketPrices].map((p, i) => (
                 <div key={i} className="flex items-center gap-1 mx-6 shrink-0">
                   <span className="text-[10px] text-[var(--text-muted)]">[{regions.find(r=>r.id===p.regionId)?.continent?.substring(0,3) || "GLB"}]</span>
                   <span className="text-[11px]">{CROPS[p.cropType]?.emoji}</span>
                   <span className="text-[10px] text-zinc-300 uppercase">{p.cropType}</span>
                   <span className="text-[10px] text-green-400 font-mono ml-1">${p.price}</span>
                   {event?.effects?.demand?.includes(p.cropType) && <span className="text-[8px] text-orange-400 ml-1">▲</span>}
                 </div>
               ))
             ) : (
               <span className="text-xs text-[var(--text-muted)] mx-4">Awaiting market data...</span>
             )}
           </div>
         </div>
      </div>
    </div>
  );
}
