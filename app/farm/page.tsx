"use client";

import { useEffect, useRef, useState } from "react";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";

export default function FarmPage() {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
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
  const [showSeedPortal, setShowSeedPortal] = useState(false);

  const [selectedCrop, setSelectedCrop] = useState("WHEAT");
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [farmsState, setFarmsState] = useState<any[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isActionPending, setIsActionPending] = useState(false);
  const [tick, setTick] = useState(0);
  const statusInFlight = useRef(false);
  const pricesInFlight = useRef(false);
  const initialLoadRef = useRef(true);

  const walletFetch = async (url: string, options?: RequestInit) => {
    const wallet = walletAddress || getStoredWalletAddress();
    if (!wallet) {
      setMessage("Connect wallet first.");
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
  };

  // ---------------- LOAD STATUS ----------------

  const loadStatus = async (options?: { force?: boolean }) => {
    if (statusInFlight.current && !options?.force) {
      return;
    }

    statusInFlight.current = true;
    if (initialLoadRef.current) {
      setIsBootstrapping(true);
    }
    try {
      const res = await walletFetch("/api/status");
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to load status");
        return;
      }

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
    } finally {
      statusInFlight.current = false;
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setIsBootstrapping(false);
      }
    }
  };

  // ---------------- UPDATE PRICES ----------------

  const updatePrices = async (options?: { force?: boolean }) => {
    if (pricesInFlight.current && !options?.force) {
      return;
    }

    pricesInFlight.current = true;
    try {
      await walletFetch("/api/update-prices", { method: "POST" });
    } catch (err) {
      console.error("Failed to update prices", err);
    } finally {
      pricesInFlight.current = false;
    }
  };

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

    void loadStatus({ force: true });

    // Refresh game state every 15 seconds
    const statusInterval = setInterval(() => {
      void loadStatus();
    }, 15000);

    // Auto-update prices every 60 seconds
    const priceInterval = setInterval(() => {
      void updatePrices();
    }, 60000);

    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(priceInterval);
      clearInterval(tickInterval);
    };
  }, [walletAddress]);

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

  // ---------------- ADVANCE YEAR ----------------

  const advanceTime = async () => {
    const res = await walletFetch("/api/advance-time", {
      method: "POST",
    });

    const data = await res.json();
    setMessage(data.message || data.error || "");
    void loadStatus({ force: true });
  };

  // ---------------- TRAVEL ----------------

  const travelTo = async (regionId: string) => {
    try {
      const res = await walletFetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionId }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "");
      void loadStatus({ force: true });
      setShowMap(false);
    } catch (err) {
      setMessage("Travel failed");
    }
  };

  // ---------------- TILE CLICK ----------------

  const handleTileClick = async (index: number) => {
    const tile = tiles.find((t) => t.index === index);
    if (!tile) return;
    if (isActionPending) return;

    setIsActionPending(true);

    try {
      if (!tile.unlocked) {
        const res = await walletFetch("/api/buy-tile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index }),
        });
        const data = await res.json();
        setMessage(data.message || data.error || "");
        if (res.ok) {
          // Optimistic: unlock the tile immediately
          setTiles(prev => prev.map(t => t.index === index ? { ...t, unlocked: true } : t));
        }
        void loadStatus({ force: true });
        return;
      }

      const crop = crops.find((c) => c.tileIndex === index);

      if (!crop) {
        // Optimistic: show crop immediately
        const cropCfg = CROPS[selectedCrop];
        const now = Date.now();
        const tempCrop = {
          id: `temp-${index}`,
          type: selectedCrop,
          tileIndex: index,
          plantedAt: new Date().toISOString(),
          readyAt: new Date(now + (cropCfg?.growTime || 10000)).toISOString(),
        };
        setCrops(prev => [...prev, tempCrop]);

        const res = await walletFetch("/api/plant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index, type: selectedCrop }),
        });
        const data = await res.json();
        setMessage(data.message || data.error || "");
        if (!res.ok) {
          // Revert optimistic crop on failure
          setCrops(prev => prev.filter(c => c.id !== `temp-${index}`));
        } else {
          // Replace temp with real data
          void loadStatus({ force: true });
        }
      } else {
        const status = new Date(crop.readyAt) <= new Date() ? "Ready" : "Growing";
        if (status !== "Ready") {
          setMessage("Crop not ready yet");
          return;
        }

        // Optimistic: remove crop and add to inventory
        const cropCfg = CROPS[crop.type];
        setCrops(prev => prev.filter(c => c.tileIndex !== index));
        setInventory(prev => {
          const existing = prev.find(i => i.cropType === crop.type);
          if (existing) return prev.map(i => i.cropType === crop.type ? { ...i, quantity: i.quantity + 1 } : i);
          return [...prev, { id: `inv-temp-${crop.type}`, cropType: crop.type, quantity: 1 }];
        });
        setMessage(`Harvested ${cropCfg?.name || crop.type}!`);

        const res = await walletFetch("/api/harvest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: index }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.message || data.error || "Harvest failed");
          void loadStatus({ force: true });
        } else {
          setMessage(data.message || `Harvested ${cropCfg?.name}!`);
          // Sync real state in background
          void loadStatus();
        }
      }
    } catch {
      setMessage("Action failed");
      void loadStatus({ force: true });
    } finally {
      setIsActionPending(false);
    }
  };

  // ---------------- SELL ----------------

  const sellCrop = async (cropType: string) => {
    // Get current market price for optimistic money update
    const priceEntry = marketPrices.find(p => p.cropType === cropType);
    const salePrice = priceEntry?.price ?? 0;

    // Optimistic: decrement inventory and add money
    setInventory(prev => prev
      .map(i => i.cropType === cropType ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0)
    );
    if (salePrice > 0) setMoney(prev => prev + salePrice);

    const res = await walletFetch("/api/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropType, quantity: 1 }),
    });
    const data = await res.json();
    setMessage(data.message || data.error || "");
    if (!res.ok) {
      // Revert on failure
      void loadStatus({ force: true });
    } else {
      // Sync in background (non-blocking)
      void loadStatus();
    }
  };

  // ---------------- RESET ----------------

  const resetGame = async () => {
    if (!confirm("Are you sure you want to reset EVERYTHING? All progress will be lost.")) return;

    const res = await walletFetch("/api/reset", { method: "POST" });
    const data = await res.json();
    setMessage(data.message || data.error || "");
    void loadStatus({ force: true });
  };

  // ---------------- TIMER ----------------

  const fmtTimer = (crop: any) => {
    const ms = new Date(crop.readyAt).getTime() - Date.now();
    if (ms <= 0) return { ready: true, label: "READY TO HARVEST", pct: 100 };
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const total = new Date(crop.readyAt).getTime() - new Date(crop.plantedAt).getTime();
    return {
      ready: false,
      label: h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`,
      pct: Math.min(100, ((total - ms) / total) * 100)
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const nextEraEntry = levelYearPairs.find(p => p.year > year);

  useEffect(() => {
    const keys = Object.keys(CROPS).filter(k => !CROPS[k].itemType || CROPS[k].itemType === "crop");
    const firstAllowed = keys.find((k) => {
      const cfg = CROPS[k] as any;
      if (cfg.regions && currentRegion && !cfg.regions.includes(currentRegion.name)) return false;
      if (cfg.unlockLevel && (level ?? 1) < cfg.unlockLevel) return false;
      return true;
    });
    if (firstAllowed && !Object.keys(CROPS).includes(selectedCrop)) setSelectedCrop(firstAllowed);
    if (firstAllowed && selectedCrop) {
      const selCfg = CROPS[selectedCrop] as any;
      const selAllowed = !(selCfg.regions && currentRegion && !selCfg.regions.includes(currentRegion.name)) && !(selCfg.unlockLevel && (level ?? 1) < selCfg.unlockLevel);
      if (!selAllowed) setSelectedCrop(firstAllowed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRegion, level]);

  // suppress unused var lint for tick (used to trigger re-renders for fmtTimer)
  void tick;

  const NAV = [
    { icon: "🌾", label: "The Farm",        href: "/farm",        active: true  },
    { icon: "🔧", label: "Engineering",      href: "/crafting",    active: false },
    { icon: "🏪", label: "Marketplace",      href: "/marketplace", active: false },
    { icon: "🌐", label: "Exchange",          href: "/section",     active: false },
    { icon: "🗺️", label: "World Map",        href: null,           active: false },
    { icon: "🏆", label: "Achievements",      href: null,           active: false },
    { icon: "👑", label: "Leaderboard",       href: null,           active: false },
  ];

  const eventImages: Record<string, string> = {
    "Peaceful Times": "/Peacfultime.png",
    "The Titanic Era": "/Titanic-era.png",
  };
  const eventImage = event?.name ? eventImages[event.name] : undefined;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden" style={{fontFamily:"'Share Tech Mono','Courier New','Apple Color Emoji','Segoe UI Emoji',monospace",fontSize:"13px"}}>

      {/* LOADING */}
      {isBootstrapping && (
        <div className="fixed inset-0 z-50 bg-[rgba(var(--background-rgb),0.88)] flex items-center justify-center">
          <div className="border border-zinc-600 px-8 py-4 text-green-400 text-sm font-bold tracking-widest">[ LOADING CHRONOFARM... ]</div>
        </div>
      )}

      {/* --- TOP BAR --- */}
      <header className="flex items-center gap-4 px-4 py-2 border-b border-zinc-700 shrink-0 bg-[var(--panel-bg)]">
        <span className="font-black text-white tracking-widest text-base mr-4">CHRONOFARM</span>
        <div className="flex-1 flex items-center justify-center gap-6 text-xs text-zinc-400">
          <span>LEVEL <span className="text-white font-bold">{level}</span></span>
          <span className="text-zinc-700">•</span>
          <span>BALANCE <span className="text-yellow-400 font-bold">${money}</span></span>
          <span className="text-zinc-700">•</span>
          <span>REGION <span className="text-blue-400 font-bold">{currentRegion?.name || "—"}</span></span>
          <span className="text-zinc-700">•</span>
          <span>WALLET <span className="text-cyan-400 font-bold">{walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : "—"}</span></span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={() => void loadStatus({force:true})} className="btn-game btn-game-dark" style={{padding:"5px 10px",fontSize:"10px"}}>⟳ SYNC</button>
          <button onClick={handleLogout} className="btn-game btn-game-red" style={{padding:"5px 10px",fontSize:"10px"}}>🚪 LOGOUT</button>
        </div>
      </header>

      {/* ——— BODY ——— */}
      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <aside className="w-48 border-r border-zinc-700 flex flex-col shrink-0 bg-[var(--panel-bg)]">
          <div className="px-3 py-2 border-b border-zinc-700 text-[11px] text-zinc-500 uppercase tracking-widest" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px",letterSpacing:"0.05em"}}>SIDEBAR</div>
          <nav className="flex-1 overflow-y-auto">
            {NAV.map(n => {
              const cls = `flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-all ${n.active ? "text-green-400 border-l-2 border-green-500 bg-green-950/10" : "text-zinc-400 border-l-2 border-transparent hover:text-zinc-200 hover:bg-[rgba(var(--card-bg-rgb),0.7)]"}`;
              const inner = <><span>{n.icon}</span><span>{n.label}</span></>;
              if (n.href && !n.active) return <Link key={n.label} href={n.href}><div className={cls}>{inner}</div></Link>;
              return <div key={n.label} className={cls} onClick={n.label === "World Map" ? () => setShowMap(!showMap) : undefined}>{inner}</div>;
            })}
          </nav>
          <div className="border-t border-zinc-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 border border-zinc-600 flex items-center justify-center bg-[var(--card-bg)]">👨‍🌾</div>
              <div><div className="text-[10px] text-zinc-500">Farmer</div><div className="text-[11px] font-bold">ChronoMaster</div></div>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[9px] text-center">
              <div className="border border-zinc-800 py-0.5"><div className="text-zinc-500">XP</div><div className="text-zinc-300">{xp}</div></div>
              <div className="border border-zinc-800 py-0.5"><div className="text-zinc-500">LVL</div><div className="text-zinc-300">{level}</div></div>
            </div>
            <button onClick={resetGame} className="btn-game btn-game-dark mt-2 w-full" style={{padding:"6px 8px",fontSize:"9px",color:"#71717a"}}>☢ RESET</button>
          </div>
        </aside>

        {/* CENTER */}
        <div className="flex-1 flex flex-col border-r border-zinc-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-[var(--panel-bg)] shrink-0">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">MAIN FARM</span>
            {message && <span className={`text-[10px] truncate max-w-xs ${message.toLowerCase().includes("fail") ? "text-red-400" : "text-blue-400"}`}>{message}</span>}
            <div className="flex items-center gap-2 text-[10px]">
              {event && <span className="text-yellow-500">⚡ {event.name}</span>}
              <span className="border border-zinc-700 px-2 py-0.5 text-green-500">XP {xp}</span>
            </div>
          </div>

          {showMap ? (
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setShowMap(false)} className="btn-game btn-game-dark">← BACK</button>
                <span className="text-sm font-bold">WORLD MAP</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {regions.map(r => {
                  const maxLv = farmsState.length ? Math.max(...farmsState.map(f => f.level ?? 1)) : level;
                  const locked = r.unlockLevel && maxLv < r.unlockLevel;
                  const isCurrent = r.id === currentRegion?.id;
                  return (
                    <div key={r.id} className={`border p-4 transition-all ${isCurrent ? "border-blue-500 bg-blue-950/10" : locked ? "border-zinc-800 opacity-40" : "border-zinc-700 hover:border-zinc-500 cursor-pointer"}`}>
                      <div className="text-[9px] text-blue-400 uppercase tracking-widest mb-1">{r.continent}</div>
                      <div className="font-bold text-sm mb-1">{r.name}</div>
                      <div className="text-[9px] text-zinc-500 mb-3 line-clamp-2">{r.description}</div>
                      {isCurrent
                        ? <div className="text-[9px] text-blue-400 border border-blue-700 px-2 py-1 text-center">[ CURRENT LOCATION ]</div>
                        : locked
                        ? <div className="text-[9px] text-zinc-600 border border-zinc-800 px-2 py-1 text-center">🔒 LOCKED — L{r.unlockLevel}</div>
                        : <button onClick={() => travelTo(r.id)} className="btn-game btn-game-blue w-full" style={{fontSize:"9px",padding:"6px"}}>✈ TRAVEL HERE</button>
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Farm grid */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-[var(--background)] bg-[url('/farm-bg.png')] bg-cover bg-center">
                <div className="absolute inset-0 bg-[rgba(var(--background-rgb),0.45)] pointer-events-none" />
                <div className="absolute left-4 top-4 z-20 flex flex-col items-start gap-2">
                  <button
                    onClick={() => setShowSeedPortal(prev => !prev)}
                    className="btn-game btn-game-green"
                    style={{fontSize:"10px",padding:"6px 10px"}}
                  >
                    SEEDS
                  </button>
                  <div className="text-[9px] text-zinc-300 bg-[rgba(var(--panel-bg-rgb),0.8)] border border-zinc-700 rounded px-2 py-1">
                    Selected: <span className="text-emerald-300">{CROPS[selectedCrop]?.name || selectedCrop}</span>
                  </div>
                </div>
                {showSeedPortal && (
                  <div className="absolute left-4 top-16 z-20 w-56 h-56 bg-[rgba(var(--panel-bg-rgb),0.95)] border border-emerald-700/40 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] p-2 flex flex-col">
                    <div className="text-[9px] text-emerald-300 uppercase tracking-widest mb-2">Seeds</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(CROPS).filter(k => !CROPS[k].itemType || CROPS[k].itemType === "crop").map(k => {
                          const cfg = CROPS[k] as any;
                          const dis = (cfg.regions && currentRegion && !cfg.regions.includes(currentRegion.name)) || (cfg.unlockLevel && level < cfg.unlockLevel);
                          return (
                            <button
                              key={k}
                              onClick={() => !dis && setSelectedCrop(k)}
                              disabled={!!dis}
                              className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[10px] transition-all ${selectedCrop === k ? "border-emerald-500 text-emerald-200 bg-emerald-950/40" : dis ? "border-zinc-800 text-zinc-600 bg-zinc-950/50 cursor-not-allowed opacity-60" : "border-zinc-700 text-zinc-300 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/60"}`}
                            >
                              <span className="truncate">{cfg.emoji} {cfg.name}</span>
                              {selectedCrop === k && <span className="text-[9px] text-emerald-300">ACTIVE</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {isActionPending && (
                  <div className="absolute inset-0 z-10 bg-[rgba(var(--background-rgb),0.6)] flex items-center justify-center">
                    <span className="border border-zinc-600 px-4 py-2 text-xs text-green-400">[ PROCESSING... ]</span>
                  </div>
                )}
                <div className="w-full max-w-2xl relative z-10">
                  <div className="text-[9px] text-zinc-600 text-center uppercase tracking-widest mb-4">FARM VIEW</div>
                  <div className="p-4 md:p-5 mb-4 rounded-lg bg-[radial-gradient(circle_at_20%_20%,#5f8d2f_0%,#416625_45%,#2b4a17_100%)] ring-4 ring-[#2f4c13] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Array.from({length: 9}).map((_, idx) => {
                        const tile = tiles.find(t => t.index === idx);
                        const crop = crops.find(c => c.tileIndex === idx);
                        const timer = crop ? fmtTimer(crop) : null;
                        const tileFrame = "aspect-[5/4] cursor-pointer group transition-all";
                        const woodFrame = "rounded-md p-1 bg-[#5a3b22] shadow-[0_3px_10px_rgba(0,0,0,0.6),inset_0_0_12px_rgba(0,0,0,0.6)]";
                        const soilBase = "w-full h-full rounded-md bg-[radial-gradient(circle_at_30%_30%,#3b2a1a_0%,#2a1c12_70%)] border border-[#24160c] flex flex-col items-center justify-between p-2 relative overflow-hidden";

                        if (tile && !tile.unlocked) return (
                          <div key={idx} onClick={() => handleTileClick(idx)} className={tileFrame}>
                            <div className={`${woodFrame} group-hover:brightness-110 transition-all`}>
                              <div className={`${soilBase} justify-center gap-2`}>
                                <span className="text-[10px] text-zinc-400 font-bold tracking-widest">LOCKED</span>
                                <span className="text-[10px] text-zinc-300 font-bold tracking-widest">UNLOCK PLOT</span>
                                <span className="text-[10px] text-green-300 bg-green-950/70 px-3 py-1 rounded border border-green-800 mt-1 font-bold">${(idx+1)*20}</span>
                              </div>
                            </div>
                          </div>
                        );
                        if (!crop) return (
                          <div key={idx} onClick={() => handleTileClick(idx)} className={tileFrame}>
                            <div className={`${woodFrame} group-hover:brightness-110 transition-all`}>
                              <div className={`${soilBase} justify-center gap-2`}>
                                <span className="text-4xl opacity-20 group-hover:opacity-50 transition-opacity">{CROPS[selectedCrop]?.emoji || "SEED"}</span>
                                <span className="text-[10px] text-zinc-400 group-hover:text-amber-400 font-bold tracking-widest transition-colors">PLANT</span>
                              </div>
                            </div>
                          </div>
                        );
                        return (
                          <div key={crop.id} onClick={() => handleTileClick(idx)} className={tileFrame}>
                            <div className={`${woodFrame} group-hover:brightness-110 transition-all`}>
                              <div className={`${soilBase} pt-9 ${timer?.ready ? "ring-2 ring-green-500/60" : ""}`}>
                                <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-[110%] bg-gradient-to-b from-[#2b1a0c] to-[#1c1108] border border-[#4a3220] rounded-md px-2 py-1 flex items-center gap-2 shadow-lg ${timer?.ready ? "ring-1 ring-green-500/60" : ""}`}>
                                  <span className="text-sm drop-shadow-md">{CROPS[crop.type]?.emoji || "CROP"}</span>
                                  <div className="flex-1">
                                    <div className="text-[10px] text-zinc-100 font-bold tracking-widest">{CROPS[crop.type]?.name?.toUpperCase() || crop.type}</div>
                                    {!timer?.ready && timer && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <div className="h-1.5 flex-1 bg-[rgba(var(--background-rgb),0.6)] rounded-full overflow-hidden border border-black/70">
                                          <div className="h-full bg-amber-500 transition-all" style={{width: `${timer.pct}%`}} />
                                        </div>
                                        <span className="text-[9px] font-bold text-amber-200 tabular-nums">{timer?.label}</span>
                                      </div>
                                    )}
                                    {timer?.ready && (
                                      <div className="text-[9px] font-bold text-green-400 mt-1 bg-green-950/70 px-1 py-0.5 rounded text-center border border-green-800/60">READY TO HARVEST</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 flex items-end justify-center pb-1">
                                  <span className={`text-5xl drop-shadow-[0_8px_10px_rgba(0,0,0,0.7)] transition-transform ${timer?.ready ? "scale-110" : "scale-95 opacity-90"}`}>
                                    {CROPS[crop.type]?.emoji || "CROP"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => { crops.filter(c => fmtTimer(c).ready).forEach(c => handleTileClick(c.tileIndex)); }}
                      className="btn-game btn-game-green w-full" style={{fontSize:"10px"}}>🧺 HARVEST ALL</button>
                    <button onClick={() => void loadStatus({force:true})}
                      className="btn-game btn-game-blue w-full" style={{fontSize:"10px"}}>💧 REFRESH</button>
                    <button onClick={advanceTime}
                      className="btn-game btn-game-purple w-full" style={{fontSize:"10px"}}>⏩ ADV TIME</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <aside className="w-80 flex flex-col shrink-0 overflow-hidden bg-[var(--panel-bg)]">
          <div className="px-3 py-2 border-b border-zinc-700 text-[11px] text-zinc-500 uppercase tracking-widest shrink-0" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px"}}>RIGHT PANEL</div>

          {/* Global Event */}
          {event && (
            <div className="border-b border-zinc-700 p-3 shrink-0">
              <div className="text-[10px] text-yellow-500 uppercase tracking-widest mb-1.5">GLOBAL EVENT</div>
              <div className="border border-yellow-700/30 bg-yellow-950/10 p-2 rounded-lg">
                {eventImage ? (
                  <div className="relative overflow-hidden rounded border border-yellow-700/30">
                    <img
                      src={eventImage}
                      alt={event.name}
                      className="w-full h-28 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="text-[11px] font-bold text-yellow-300">"{event.name}"</div>
                      <div className="text-[10px] text-zinc-200 mt-0.5 leading-snug">{event.description}</div>
                      {event.effects.priceMultiplier && (
                        <div className="text-[10px] text-yellow-400 mt-1">Market Boost +{((event.effects.priceMultiplier - 1) * 100).toFixed(0)}%</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded border border-yellow-700/30 p-2">
                    <div className="text-sm font-bold text-yellow-300">"{event.name}"</div>
                    <div className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{event.description}</div>
                    {event.effects.priceMultiplier && (
                      <div className="text-[10px] text-yellow-500 mt-1">Market Boost +{((event.effects.priceMultiplier - 1) * 100).toFixed(0)}%</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Market Panel */}
          {npc && marketPrices.length > 0 && (
            <div className="border-b border-zinc-700 p-3 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">MARKET PANEL</div>
                <span className="text-[9px] text-zinc-600">{npc.name}</span>
              </div>
              <div className="rounded-md border border-zinc-800 bg-[rgba(var(--panel-bg-rgb),0.7)] p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                {marketPrices.map(p => {
                  const d = p.demand / (p.supply + p.demand + 0.001);
                  const badge = d > 0.65 ? {l:"VERY HIGH",c:"text-purple-400"} : d > 0.5 ? {l:"HIGH",c:"text-green-400"} : d > 0.35 ? {l:"MEDIUM",c:"text-yellow-400"} : {l:"LOW",c:"text-red-400"};
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded hover:bg-[rgba(var(--card-bg-rgb),0.7)]">
                      <span>{CROPS[p.cropType]?.emoji}</span>
                      <span className="text-zinc-300 flex-1">{p.cropType}</span>
                      <span className="text-green-400 font-bold">${p.price}</span>
                      <span className={`text-[9px] ${badge.c}`}>{badge.l}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="p-3 shrink-0">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">QUICK ACTIONS</div>
            <div className="grid grid-cols-2 gap-1.5">
              <Link href="/crafting" className="btn-game btn-game-dark w-full" style={{fontSize:"10px",padding:"8px 6px"}}>⚙️ Crafting</Link>
              <Link href="/marketplace" className="btn-game btn-game-dark w-full" style={{fontSize:"10px",padding:"8px 6px"}}>🏪 Market</Link>
              <button onClick={() => setShowMap(true)} className="btn-game btn-game-dark w-full" style={{fontSize:"10px",padding:"8px 6px"}}>🗺️ World Map</button>
              <Link href="/section" className="btn-game btn-game-dark w-full" style={{fontSize:"10px",padding:"8px 6px"}}>💬 Chat</Link>
            </div>
          </div>
        </aside>
      </div>

      {/* ——— BOTTOM ROW ——— */}
      <div className="flex border-t border-zinc-700 shrink-0 bg-[var(--panel-bg)]" style={{height:"130px"}}>

        {/* Global Chat */}
        <div className="flex-1 border-r border-zinc-700 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"7px"}}>GLOBAL CHAT</div>
          <div className="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar">
            <div className="text-[9px] text-zinc-600 italic">[chat messages....]</div>
          </div>
          <div className="border-t border-zinc-800 px-3 py-1 shrink-0">
            <Link href="/section" className="btn-game btn-game-dark" style={{fontSize:"8px",padding:"4px 8px"}}>💬 OPEN CHAT</Link>
          </div>
        </div>

        {/* Time Travel */}
        <div className="flex-1 border-r border-zinc-700 flex flex-col">
          <div className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"7px"}}>TIME TRAVEL</div>
          <div className="flex-1 flex items-center justify-between px-4">
            <div>
              <div className="text-[9px] text-zinc-500 mb-1">Current Era → <span className="text-indigo-400 font-bold">{year}</span></div>
              {nextEraEntry && <div className="text-[9px] text-zinc-500 mb-2">Next Era → <span className="text-purple-400 font-bold">{nextEraEntry.year}</span></div>}
              <div className="w-32 h-1.5 bg-[rgba(var(--card-bg-rgb),0.7)] overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{width: `${Math.min(100,(xp % 15) / 15 * 100)}%`}} />
              </div>
              <div className="text-[8px] text-zinc-600 mt-0.5">{xp % 15}/15 era XP</div>
            </div>
            <button onClick={advanceTime} className="btn-game btn-game-indigo" style={{fontSize:"9px"}}>⏳ ADVANCE ERA</button>
          </div>
        </div>

        {/* Daily Rewards */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0" style={{fontFamily:"'Press Start 2P',monospace",fontSize:"7px"}}>DAILY REWARDS</div>
          <div className="flex-1 flex items-center px-3 gap-1.5">
            {[
              {day:1,icon:"✅",label:"$500"},
              {day:2,icon:"💎",label:"x10"},
              {day:3,icon:"🌾",label:"x1"},
              {day:4,icon:"⭐",label:"$1,000"},
              {day:5,icon:"💰",label:"x20"},
              {day:6,icon:"🎁",label:"x1"},
            ].map(r => (
              <div key={r.day} className={`flex flex-col items-center border p-1.5 flex-1 ${r.day === 1 ? "border-green-600 bg-green-950/20" : "border-zinc-700"}`}>
                <div className="text-[8px] text-zinc-500">Day {r.day}</div>
                <div className="text-base">{r.icon}</div>
                <div className="text-[7px] text-zinc-500">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

