"use client";

import { useEffect, useState } from "react";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";
import Link from "next/link";

export default function FarmPage() {
  const [money, setMoney] = useState(0);
  const [year, setYear] = useState(1910);
  const [lastAdvanced, setLastAdvanced] = useState<string>(new Date().toISOString());
  const [event, setEvent] = useState<any>(null);

  const [crops, setCrops] = useState<any[]>([]);
  const [tiles, setTiles] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [npc, setNpc] = useState<any>(null);
  const [regions, setRegions] = useState<any[]>([]);
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);

  const [selectedCrop, setSelectedCrop] = useState("WHEAT");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [farmsState, setFarmsState] = useState<any[]>([]);

  // ---------------- LOAD STATUS ----------------

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();

      setMoney(data.money ?? 0);
      setYear(data.year ?? 1910);
      setLastAdvanced(data.lastAdvanced ?? new Date().toISOString());
      setEvent(data.event ?? null);
      setCrops(data.crops ?? []);
      setTiles(data.tiles ?? []);
      setInventory(data.inventory ?? []);
      setMarketPrices(data.prices ?? []);
      setNpc(data.npc ?? null);
      setRegions(data.regions ?? []);
      setCurrentRegion(data.currentRegion ?? null);
      setLevel(data.level ?? 1);
      setXp(data.xp ?? 0);
      setFarmsState(data.farms ?? []);
    } catch (err) {
      console.error("Failed to load status", err);
    }
  };

  // ---------------- UPDATE PRICES ----------------

  const updatePrices = async () => {
    try {
      await fetch("/api/update-prices", { method: "POST" });
    } catch (err) {
      console.error("Failed to update prices", err);
    }
  };

  useEffect(() => {
    loadStatus();

    // Refresh game state every second
    const statusInterval = setInterval(loadStatus, 1000);
    
    // Auto-update prices every second from frontend as requested
    const priceInterval = setInterval(updatePrices, 1000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(priceInterval);
    };
  }, []);

  // ---------------- ADVANCE YEAR ----------------

  const advanceTime = async () => {
    const res = await fetch("/api/advance-time", {
      method: "POST",
    });

    const data = await res.json();
    setMessage(data.message || data.error || "");
    loadStatus();
  };

  // ---------------- TRAVEL ----------------

  const travelTo = async (regionId: string) => {
    try {
      const res = await fetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      loadStatus();
      setShowMap(false);
    } catch (err) {
      setMessage("Travel failed");
    }
  };

  // ---------------- TILE CLICK ----------------

  const handleTileClick = async (index: number) => {
    const tile = tiles.find((t) => t.index === index);

    if (!tile) return;

    try {
      if (!tile.unlocked) {
        const res = await fetch("/api/buy-tile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index }),
        });

        const data = await res.json();
        setMessage(data.message || data.error || "");
        loadStatus();
        return;
      }

      const crop = crops.find((c) => c.tileIndex === index);

      if (!crop) {
        const res = await fetch("/api/plant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index, type: selectedCrop }),
        });

        const data = await res.json();
        setMessage(data.message || data.error || "");
      } else {
        const res = await fetch("/api/harvest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index }),
        });

        const data = await res.json();
        setMessage(data.message || data.error || "");
      }

      loadStatus();
    } catch {
      setMessage("Action failed");
    }
  };

  // ---------------- SELL ----------------

  const sellCrop = async (cropType: string) => {
    const res = await fetch("/api/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropType, quantity: 1 }),
    });

    const data = await res.json();
    setMessage(data.message || data.error || "");
    loadStatus();
  };

  // ---------------- RESET ----------------

  const resetGame = async () => {
    if (!confirm("Are you sure you want to reset EVERYTHING? All progress will be lost.")) return;

    const res = await fetch("/api/reset", { method: "POST" });
    const data = await res.json();
    setMessage(data.message || data.error || "");
    loadStatus();
  };

  // ---------------- TIMER ----------------

  const getStatus = (crop: any) => {
    const now = new Date();
    const ready = new Date(crop.readyAt);
    const seconds = Math.floor((ready.getTime() - now.getTime()) / 1000);

    if (seconds <= 0) return "Ready";
    return `Growing ${seconds}s`;
  };

  // ---------------- UI ----------------

  const levelYearPairs = Object.keys(EVENTS)
    .map((year) => parseInt(year, 10))
    .sort((a, b) => a - b)
    .map((eventYear, index) => ({ level: index + 1, year: eventYear }));

  // Ensure selected crop is valid for current region and level
  useEffect(() => {
    const keys = Object.keys(CROPS);
    const firstAllowed = keys.find((k) => {
      const cfg = CROPS[k] as any;
      // region check
      if (cfg.regions && currentRegion && !cfg.regions.includes(currentRegion.name)) return false;
      // level check
      if (cfg.unlockLevel && (level ?? 1) < cfg.unlockLevel) return false;
      return true;
    });
    if (firstAllowed && !Object.keys(CROPS).includes(selectedCrop)) {
      setSelectedCrop(firstAllowed);
    }
    if (firstAllowed && selectedCrop) {
      const selCfg = CROPS[selectedCrop] as any;
      const selAllowed = !(selCfg.regions && currentRegion && !selCfg.regions.includes(currentRegion.name)) && !(selCfg.unlockLevel && (level ?? 1) < selCfg.unlockLevel);
      if (!selAllowed) setSelectedCrop(firstAllowed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRegion, level]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-8 font-sans selection:bg-green-500/30">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="flex justify-between items-end mb-12 border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-4 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
              CHRONOFARM
            </h1>
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Timeline</span>
                  <h2 className="text-2xl font-mono font-bold text-zinc-300">📅 {year}</h2>
              </div>
              <div className="h-10 w-[1px] bg-zinc-900"></div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Balance</span>
                <h2 className="text-2xl font-mono font-bold text-green-500">💰 ${money}</h2>
              </div>
              <div className="h-10 w-[1px] bg-zinc-900"></div>
              {currentRegion && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Location</span>
                  <div className="flex items-center gap-2 text-blue-400">
                    <span className="text-xl">📍</span>
                    <h2 className="text-xl font-bold tracking-tight">{currentRegion.name}</h2>
                  </div>
                </div>
              )}
                <div className="h-10 w-[1px] bg-zinc-900"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">Farm Level</span>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono font-bold">L{level}</div>
                    <div className="w-40 bg-zinc-800 rounded-full h-3 overflow-hidden">
                      <div className="h-3 bg-green-500" style={{ width: `${Math.min(100, (xp % 100))}%` }}></div>
                    </div>
                    <div className="text-sm text-zinc-400">{xp} XP</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                    {levelYearPairs.slice(0, 4).map((item) => (
                      <span key={item.level} className="px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800">
                        L{item.level} → {item.year}
                      </span>
                    ))}
                  </div>
                </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Link
              href="/marketplace"
              className="px-8 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-zinc-800 shadow-xl active:scale-95 flex items-center gap-3"
            >
              <span className="text-xl">⚖️</span>
              Marketplace
            </Link>
            <button
              onClick={() => setShowMap(!showMap)}
              className="px-8 py-4 bg-zinc-900 hover:bg-zinc-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-zinc-800 shadow-xl active:scale-95 flex items-center gap-3"
            >
              <span className="text-xl">🗺️</span>
              {showMap ? "Back to Farm" : "World Map"}
            </button>
            <div className="px-8 py-4 bg-green-600/10 border border-green-500/30 rounded-2xl font-black text-xs uppercase tracking-widest text-green-400 flex items-center gap-3">
              <span className="text-xl">⏩</span>
              Auto year sync
            </div>
          </div>
        </header>

        {/* WORLD MAP VIEW */}
        {showMap ? (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {regions.map((r) => (
                <div 
                  key={r.id}
                  className={`relative group rounded-3xl overflow-hidden border-2 transition-all duration-500 ${
                    r.id === currentRegion?.id 
                      ? "border-blue-500 shadow-2xl shadow-blue-900/20 scale-105 z-10" 
                      : "border-zinc-900 hover:border-zinc-700 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img 
                    src={`/maps/${r.name.toLowerCase()}.png`} 
                    alt={r.name}
                    className="w-full h-80 object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                  
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-2 block">{r.continent}</span>
                    <h3 className="text-3xl font-black mb-3 tracking-tighter">{r.name}</h3>
                    <p className="text-sm text-zinc-400 mb-6 line-clamp-2 italic font-serif leading-relaxed">"{r.description}"</p>
                    
                    {r.id === currentRegion?.id ? (
                      <div className="w-full py-3 bg-blue-500 text-black text-center font-black text-[10px] uppercase tracking-widest rounded-xl">
                        Current Location
                      </div>
                    ) : (
                      (() => {
                        const maxLevel = farmsState.length ? Math.max(...farmsState.map((f) => f.level ?? 1)) : (level ?? 1);
                        const levelLocked = r.unlockLevel && (maxLevel ?? 1) < r.unlockLevel;
                        const requiredYear = levelYearPairs.find((item) => item.level === r.unlockLevel)?.year;
                        return levelLocked ? (
                          <div className="space-y-2">
                            <div className="w-full py-3 bg-zinc-800 text-zinc-500 text-center font-black text-[10px] uppercase tracking-widest rounded-xl">
                              Locked (L{r.unlockLevel})
                            </div>
                            <div className="w-full py-2 bg-black/60 border border-zinc-800 text-zinc-300 text-center rounded-xl text-[10px] font-bold uppercase tracking-widest">
                              Unlocks at {requiredYear ? `Year ${requiredYear}` : `Level ${r.unlockLevel}`}
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => travelTo(r.id)}
                            className="w-full py-3 bg-zinc-100 hover:bg-white text-black text-center font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                          >
                            Travel to Region
                          </button>
                        );
                      })()
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
            
            {/* LEFT: FARM & EVENTS */}
            <div className="xl:col-span-8 space-y-8">
              
              {/* HISTORICAL EVENT */}
              {event && (
                <div className="p-8 bg-zinc-900/50 rounded-3xl border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                  <div className="flex justify-between items-start">
                    <div className="max-w-xl">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-3 block">⚠️ Global Event In Progress</span>
                      <h3 className="text-3xl font-black tracking-tighter mb-4 italic font-serif">"{event.name}"</h3>
                      <p className="text-zinc-400 leading-relaxed text-sm mb-6">{event.description}</p>
                      <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 italic text-zinc-300 text-sm">
                        <span className="text-2xl">💬</span>
                        "{event.dialogue}"
                      </div>
                    </div>
                    {event.effects.priceMultiplier && (
                      <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl text-center">
                        <span className="text-xs font-bold text-red-500 block mb-1">Market Impact</span>
                        <span className="text-2xl font-black text-red-400">{event.effects.priceMultiplier > 1 ? "📈" : "📉"} {(event.effects.priceMultiplier * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* MESSAGE BAR */}
              <div className="flex items-center gap-4 font-mono text-xs text-zinc-500 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
                <span className="text-green-500 animate-pulse">●</span>
                <span className="text-zinc-700">CONSOLE {">"}</span>
                <span className={message.includes("failed") ? "text-red-400" : "text-blue-400"}>{message || "Waiting for action..."}</span>
              </div>

              {/* FARM GRID */}
              <div className="grid grid-cols-3 gap-6 bg-zinc-900/20 p-6 rounded-[2.5rem] border border-zinc-800/50 shadow-inner">
                {Array.from({ length: 9 }).map((_, index) => {
                  const tile = tiles.find((t) => t.index === index);
                  const crop = crops.find((c) => c.tileIndex === index);

                  if (tile && !tile.unlocked) {
                    const cost = (index + 1) * 20;
                    return (
                      <div
                        key={index}
                        onClick={() => handleTileClick(index)}
                        className="aspect-square flex flex-col items-center justify-center rounded-3xl cursor-pointer border-2 border-dashed border-zinc-800 bg-black/40 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all group"
                      >
                        <span className="text-4xl mb-4 grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all">🔒</span>
                        <span className="text-[10px] uppercase font-black text-zinc-600 group-hover:text-zinc-400 tracking-widest">Unlock Field</span>
                        <span className="text-sm font-mono text-yellow-600 mt-2 font-bold">${cost}</span>
                      </div>
                    );
                  }

                  if (!crop) {
                    return (
                      <div
                        key={index}
                        onClick={() => handleTileClick(index)}
                        className="aspect-square flex items-center justify-center rounded-3xl cursor-pointer border-2 border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/60 transition-all group shadow-2xl"
                      >
                        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-3xl opacity-10 group-hover:opacity-100 group-hover:scale-110 transition-all">
                          🌱
                        </div>
                      </div>
                    );
                  }

                  const status = getStatus(crop);
                  const isReady = status === "Ready";

                  return (
                    <div
                      key={crop.id}
                      onClick={() => handleTileClick(index)}
                      className={`aspect-square flex flex-col items-center justify-center rounded-3xl cursor-pointer border-2 transition-all shadow-2xl relative overflow-hidden group ${
                        isReady 
                          ? "bg-green-900/20 border-green-500 shadow-green-900/20" 
                          : "bg-orange-900/10 border-orange-800/30 shadow-orange-900/5"
                      }`}
                    >
                      {isReady && <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 blur-2xl rounded-full"></div>}
                      <span className={`text-6xl mb-4 transition-transform group-hover:scale-110 ${isReady ? "animate-bounce" : "animate-pulse"}`}>
                        {CROPS[crop.type]?.emoji || "🌾"}
                      </span>
                      <div className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${isReady ? "bg-green-500 text-black shadow-lg shadow-green-500/40" : "bg-zinc-800 text-zinc-400"}`}>
                        {status}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: MARKETPLACE & INVENTORY */}
            <div className="xl:col-span-4 space-y-8">
              
              {/* NPC / TRADER */}
              {npc && (
                <div className="p-6 bg-gradient-to-br from-zinc-900 to-black rounded-3xl border border-zinc-800 shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-3xl shadow-xl border border-zinc-700">
                      🏛️
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block">Region Authority</span>
                      <h3 className="text-xl font-black tracking-tight">{npc.name}</h3>
                    </div>
                  </div>
                  
                  {/* MARKET PRICES */}
                  <div className="space-y-3">
                    {marketPrices.map((p) => (
                      <div key={p.id} className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 group hover:border-zinc-700 transition-all">
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{CROPS[p.cropType]?.emoji}</span>
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">{p.cropType}</span>
                          </div>
                          <div className="text-xl font-mono font-bold text-green-500">${p.price}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-blue-500" 
                              style={{ width: `${Math.min(100, (p.supply / (p.supply + p.demand)) * 100)}%` }}
                            ></div>
                            <div 
                              className="h-full bg-orange-500" 
                              style={{ width: `${Math.min(100, (p.demand / (p.supply + p.demand)) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-[8px] font-bold text-zinc-600 uppercase">S/D</span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-[9px] font-bold text-blue-400 uppercase">Supply: {p.supply}</span>
                          <span className="text-[9px] font-bold text-orange-400 uppercase">Demand: {p.demand}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CROP SELECTOR */}
              <div className="p-6 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-xl">
                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-6 block">Select Seed Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(CROPS).map((key) => {
                    const cfg = CROPS[key] as any;
                    const regionLocked = cfg.regions && currentRegion && !cfg.regions.includes(currentRegion.name);
                    const levelLocked = cfg.unlockLevel && (level ?? 1) < cfg.unlockLevel;
                    const disabled = regionLocked || levelLocked;

                    return (
                      <button
                        key={key}
                        onClick={() => !disabled && setSelectedCrop(key)}
                        disabled={disabled}
                        className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all duration-300 ${
                          selectedCrop === key 
                            ? "bg-green-500/10 border-green-500 shadow-lg shadow-green-500/10" 
                            : disabled
                            ? "bg-black/20 border-zinc-800/30 opacity-40 cursor-not-allowed"
                            : "bg-black/40 border-zinc-800 hover:border-zinc-700 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <span className="text-3xl mb-2">{cfg.emoji}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{cfg.name}</span>
                        {levelLocked && (
                          <span className="text-[9px] mt-1 text-yellow-400">Unlocks at L{cfg.unlockLevel}</span>
                        )}
                        {regionLocked && (
                          <span className="text-[9px] mt-1 text-blue-400">Not available in {currentRegion?.name}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* INVENTORY */}
              <div className="p-6 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-xl flex-grow">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] block">Warehouse</h3>
                  <span className="bg-zinc-800 px-3 py-1 rounded-full text-[9px] font-black text-zinc-400">
                    {inventory.reduce((a, b) => a + b.quantity, 0)} UNITS
                  </span>
                </div>
                
                {inventory.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-zinc-800/50 rounded-2xl text-zinc-600 text-xs italic">
                    Storage is currently empty
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inventory.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-zinc-800/50 group transition-all hover:bg-black/60"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-3xl">{CROPS[item.cropType]?.emoji}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-widest text-zinc-200">{item.cropType}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">QTY: {item.quantity}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => sellCrop(item.cropType)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-green-500/10 active:scale-95"
                        >
                          SELL $
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* FOOTER ACTIONS */}
              <button
                onClick={resetGame}
                className="w-full py-4 text-[9px] font-black text-zinc-800 hover:text-red-500 transition-colors uppercase tracking-[0.4em] border-t border-zinc-900"
              >
                ☢️ Clear Simulation Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}