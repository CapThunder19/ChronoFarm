"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CROPS } from "@/lib/crops";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";

export default function MarketplacePage() {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
  const [money, setMoney] = useState(0);
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
      setYear(data.year);
      setEvent(data.event);
      setInventory(data.inventory);
      setRegions(data.regions || []);
      setCurrentRegion(data.currentRegion);
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

  const handleLogout = async () => {
    try { await disconnectAsync(); } catch {}
    finally { clearWalletSession(); router.push("/"); }
  };

  // ——— BUY with optimistic update ———
  const handleBuy = async (price: any, region: any) => {
    const actionKey = `buy-${price.cropType}-${region.id}`;
    if (pendingActions.has(actionKey)) return;

    // Optimistic: deduct money and increment inventory immediately
    setMoney(prev => prev - price.price);
    setInventory(prev => {
      const existing = prev.find(i => i.cropType === price.cropType);
      if (existing) {
        return prev.map(i => i.cropType === price.cropType ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: `temp-${price.cropType}`, cropType: price.cropType, quantity: 1 }];
    });
    // Optimistic: reduce supply in market
    setMarketPrices(prev => prev.map(p =>
      p.id === price.id ? { ...p, supply: Math.max(0, p.supply - 1), demand: p.demand + 1 } : p
    ));

    setPendingActions(prev => new Set(prev).add(actionKey));
    try {
      const res = await walletFetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropType: price.cropType, quantity: 1, regionId: region.id }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      if (!res.ok) {
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
  const sellCropToRegion = async (cropType: string, regionId: string, salePrice: number) => {
    const actionKey = `sell-${cropType}-${regionId}`;
    if (pendingActions.has(actionKey)) return;

    // Optimistic: add money, decrement inventory
    setMoney(prev => prev + salePrice);
    setInventory(prev => prev
      .map(i => i.cropType === cropType ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0)
    );
    setMarketPrices(prev => prev.map(p =>
      p.cropType === cropType && p.regionId === regionId ? { ...p, supply: p.supply + 1 } : p
    ));

    setPendingActions(prev => new Set(prev).add(actionKey));
    try {
      const res = await walletFetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropType, quantity: 1, regionId }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      if (!res.ok) {
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Loading Exchange...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <header className="flex justify-between items-end mb-12 border-b border-zinc-900 pb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/farm" className="text-zinc-500 hover:text-white transition-colors">← Back to Farm</Link>
              <span className="text-zinc-800">/</span>
              <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                GLOBAL EXCHANGE
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <Link href="/section" className="hover:text-white transition-colors">Section</Link>
              <span className="text-zinc-800">/</span>
              <button onClick={handleLogout} className="hover:text-white transition-colors">Logout</button>
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Timeline</span>
                <h2 className="text-xl font-mono font-bold text-zinc-300">📅 {year}</h2>
              </div>
              <div className="h-8 w-[1px] bg-zinc-900"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Balance</span>
                <h2 className="text-xl font-mono font-bold text-green-500 transition-all">💰 ${money}</h2>
              </div>
            </div>
          </div>

          {event && (
            <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-2xl max-w-md animate-pulse">
              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest block mb-1">Active Event</span>
              <h3 className="text-sm font-bold italic font-serif">"{event.name}"</h3>
              <p className="text-[10px] text-zinc-500 mt-1">{event.description}</p>
            </div>
          )}
        </header>

        {message && (
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 text-xs font-mono">
            {">"} {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* LEFT: INVENTORY */}
          <div className="lg:col-span-3 space-y-8">
            <div className="p-6 bg-zinc-900/40 rounded-3xl border border-zinc-800 shadow-xl sticky top-8">
              <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-6 block">Your Stockpile</h3>
              {inventory.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-zinc-800/50 rounded-2xl text-zinc-600 text-xs italic">
                  Empty Warehouse
                </div>
              ) : (
                <div className="space-y-4">
                  {inventory.map((item) => (
                    <div key={item.id} className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 transition-all">
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{CROPS[item.cropType]?.emoji}</span>
                        <div>
                          <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{item.cropType}</div>
                          <div className="text-xl font-mono font-bold">{item.quantity} Units</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: REGIONAL DEALERS */}
          <div className="lg:col-span-9 space-y-12">
            {regions.map((region) => {
              const regionNpcs = npcs.filter(n => n.regionId === region.id);
              const prices = marketPrices.filter(p => p.regionId === region.id);
              const isLocal = region.id === currentRegion?.id;
              const regionEvent = event?.regions?.includes(region.name) || !event?.regions;
              const impact = regionEvent && event?.effects?.priceMultiplier ? event.effects.priceMultiplier : 1.0;

              return (
                <div key={region.id} className={`p-8 rounded-[2.5rem] border transition-all ${isLocal ? "bg-zinc-900/40 border-blue-500/30" : "bg-zinc-900/20 border-zinc-800/50"}`}>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">{region.continent}</span>
                        {isLocal && <span className="bg-blue-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full">YOUR LOCATION</span>}
                      </div>
                      <h2 className="text-4xl font-black tracking-tighter mb-2">{region.name}</h2>
                      <p className="text-zinc-500 text-sm italic font-serif">"{region.description}"</p>
                    </div>
                    {regionNpcs.length > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest block mb-2">Local Dealers</span>
                        <div className="flex flex-col gap-2 items-end">
                          {regionNpcs.map((npc) => (
                            <div key={npc.id} className="text-sm font-bold flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-zinc-800/50">
                              {npc.name}
                              <div className="w-6 h-6 bg-zinc-800 rounded-md flex items-center justify-center text-xs">🏛️</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {regionEvent && event && impact !== 1 && (
                    <div className="mb-8 p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">📢</span>
                        <p className="text-xs text-orange-200/70 font-medium italic">"{event.dialogue}"</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black text-orange-500 uppercase block mb-1">Market Multiplier</span>
                        <span className="text-xl font-mono font-bold text-orange-400">x{impact}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {prices.map((price) => {
                      const inStock = inventory.find(i => i.cropType === price.cropType)?.quantity || 0;
                      const isHighDemand = event?.effects?.demand?.includes(price.cropType) && regionEvent;
                      const buyKey = `buy-${price.cropType}-${region.id}`;
                      const sellKey = `sell-${price.cropType}-${region.id}`;
                      const isBuying = pendingActions.has(buyKey);
                      const isSelling = pendingActions.has(sellKey);

                      return (
                        <div key={price.id} className={`p-6 rounded-3xl border transition-all ${isHighDemand ? "bg-green-500/5 border-green-500/30" : "bg-black/40 border-zinc-800/50"}`}>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-4xl">{CROPS[price.cropType]?.emoji}</span>
                            <div className="text-right">
                              <div className="text-2xl font-mono font-bold text-green-500">${price.price}</div>
                              {isHighDemand && <span className="text-[8px] font-black text-green-500 uppercase animate-pulse">🔥 High Demand</span>}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                              <span>Supply: {price.supply}</span>
                              <span>Demand: {price.demand}</span>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                              <div className="h-full bg-blue-500" style={{ width: `${(price.supply / (price.supply + price.demand)) * 100}%` }}></div>
                              <div className="h-full bg-orange-500" style={{ width: `${(price.demand / (price.supply + price.demand)) * 100}%` }}></div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                disabled={money < price.price || isBuying}
                                onClick={() => handleBuy(price, region)}
                                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                  money >= price.price && !isBuying
                                    ? "bg-blue-500 hover:bg-blue-400 text-black active:scale-95 shadow-lg"
                                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                }`}
                              >
                                {isBuying ? "..." : `Buy 1 ($${price.price})`}
                              </button>

                              <button
                                disabled={inStock === 0 || isSelling}
                                onClick={() => sellCropToRegion(price.cropType, region.id, price.price)}
                                className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                  inStock > 0 && !isSelling
                                    ? "bg-zinc-100 hover:bg-white text-black active:scale-95 shadow-lg"
                                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                }`}
                              >
                                {isSelling ? "..." : inStock > 0 ? "Sell 1" : "No Stock"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
