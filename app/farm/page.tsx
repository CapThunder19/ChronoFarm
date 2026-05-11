"use client";

import { useEffect, useRef, useState } from "react";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";
import { Globe, X, Send, Activity, ChevronLeft, Hexagon, MapPin, Star, Settings, TrendingUp, Diamond, Clock, CircleDollarSign, Compass, Lock, Plane } from "lucide-react";
import { calculateLevelProgress } from "@/lib/progression";

type ChatMessage = {
  id: string;
  walletAddress: string;
  displayName: string;
  message: string;
  createdAt: string;
};

const INTRO_SCENES = [
  [
    "The world is changing.",
    "",
    "New technologies emerge.",
    "Global markets shift.",
    "Empires rise and collapse.",
    "",
    "Only the strongest farmers survive.",
    "",
    "Welcome to ChronoFarm."
  ],
  [
    "The year is 1910.",
    "",
    "Across the world, crops fail, markets rise,",
    "and powerful farming empires begin to emerge."
  ],
  [
    "hope you best survive...."
  ]
];

function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (sceneIdx >= INTRO_SCENES.length) {
      onComplete();
      return;
    }

    const scene = INTRO_SCENES[sceneIdx];
    
    if (lineIdx < scene.length) {
      const line = scene[lineIdx];
      if (charIdx < line.length) {
        const timer = setTimeout(() => {
          setCharIdx(c => c + 1);
        }, 40); // typing speed
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setLineIdx(l => l + 1);
          setCharIdx(0);
        }, 600); // delay between lines
        return () => clearTimeout(timer);
      }
    } else {
      setShowPrompt(true);
    }
  }, [sceneIdx, lineIdx, charIdx, onComplete]);

  const handleNext = () => {
    if (sceneIdx >= INTRO_SCENES.length) return;
    const scene = INTRO_SCENES[sceneIdx];
    
    if (lineIdx < scene.length) {
      setLineIdx(scene.length);
      setCharIdx(0);
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
      setLineIdx(0);
      setCharIdx(0);
      setSceneIdx(s => s + 1);
    }
  };

  if (sceneIdx >= INTRO_SCENES.length) return null;
  const scene = INTRO_SCENES[sceneIdx];

  return (
    <div className="fixed inset-0 z-[100] bg-[#050805] flex flex-col items-center justify-center cursor-pointer text-emerald-500" style={{fontFamily:"'Courier New', monospace"}} onClick={handleNext}>
      <div className="max-w-2xl w-full px-8 text-center text-sm md:text-lg leading-loose tracking-widest drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
        {scene.slice(0, lineIdx).map((line, i) => (
          <div key={i} className="min-h-[1.5em]">{line}</div>
        ))}
        {lineIdx < scene.length && (
          <div className="min-h-[1.5em]">
            {scene[lineIdx].substring(0, charIdx)}<span className="animate-pulse">_</span>
          </div>
        )}
      </div>
      {showPrompt && (
        <div className="absolute bottom-10 text-xs text-emerald-800 animate-pulse tracking-widest uppercase">
          [ CLICK TO CONTINUE ]
        </div>
      )}
    </div>
  );
}

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
  const [totalXp, setTotalXp] = useState(0);
  const [farmsState, setFarmsState] = useState<any[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [isActionPending, setIsActionPending] = useState(false);
  const [tick, setTick] = useState(0);
  const statusInFlight = useRef(false);
  const pricesInFlight = useRef(false);
  const initialLoadRef = useRef(true);
  const previousLevelRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

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
    let isNew = false;
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
      const serverXp = data.totalXp ?? data.xp ?? 0;
      setTotalXp(serverXp);
      setLevel(data.level ?? calculateLevelProgress(serverXp).level);
      setFarmsState(data.farms ?? []);
      const activeFarm = (data.farms ?? []).find((farm: any) => farm.regionId === data.currentRegion?.id) ?? data.farms?.[0] ?? null;
      setActiveFarmId(activeFarm?.id ?? null);
      
      if (serverXp === 0 && (data.crops?.length || 0) === 0 && (data.inventory?.length || 0) === 0) {
        isNew = true;
      }
    } catch (err) {
      console.error("Failed to load status", err);
    } finally {
      statusInFlight.current = false;
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setIsBootstrapping(false);
        const hasSeenIntro = localStorage.getItem("chronofarm_intro_seen");
        if (isNew || !hasSeenIntro) {
          setShowIntro(true);
        }
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
      statusInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!walletAddress) return;
    const streamUrl = `/api/chat/stream?since=${Date.now() - 60_000}`;
    const source = new EventSource(streamUrl);

    source.addEventListener("messages", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { messages?: ChatMessage[] };
      setMessages((prev) => {
        const newMsgs = payload.messages ?? [];
        const existingIds = new Set(prev.map((m) => m.id));
        const filtered = newMsgs.filter((m) => !existingIds.has(m.id));
        return [...prev, ...filtered].slice(-50);
      });
      
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    });

    return () => source.close();
  }, [walletAddress]);

  const sendChat = async () => {
    const msg = chatDraft.trim();
    if (!msg) return;

    try {
      setChatDraft("");
      await walletFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
    } catch (error) {
      console.error("Chat send failed");
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
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
    if (isBootstrapping) return;
    if (level !== 1) return;
    if (!activeFarmId) return;
    const hasSeenIntro = localStorage.getItem("chronofarm_intro_seen");
    const hasSeenTutorial = localStorage.getItem(`chronofarm_tutorial_seen_${activeFarmId}`);
    
    // Only trigger if intro is done and the user has never completed the newbie guide.
    if (tutorialStep === 0 && !showIntro) {
      if (!hasSeenTutorial && hasSeenIntro) {
        setTutorialStep(1);
      }
    }
  }, [isBootstrapping, showIntro, level, tutorialStep, activeFarmId]);

  useEffect(() => {
    if (tutorialStep === 4) {
      const crop = crops.find(c => c.tileIndex === 0);
      if (crop) setTutorialStep(5);
    } else if (tutorialStep === 5) {
      const crop = crops.find(c => c.tileIndex === 0);
      if (crop && new Date(crop.readyAt) <= new Date()) {
        setTutorialStep(6);
      }
    } else if (tutorialStep === 6) {
      const crop = crops.find(c => c.tileIndex === 0);
      if (!crop && inventory.some(i => i.quantity > 0)) {
        setTutorialStep(7);
      }
    }
  }, [tutorialStep, crops, tick, inventory]);

  useEffect(() => {
    if (isBootstrapping || showIntro) return;
    if (!activeFarmId) return;

    const unlockSeenKey = `chronofarm_marketplace_unlock_seen_${activeFarmId}`;
    const skillsUnlockSeenKey = `chronofarm_skills_unlock_seen_${activeFarmId}`;
    const prevLevel = previousLevelRef.current;
    const hasSeenUnlockFlow = localStorage.getItem(unlockSeenKey);

    if (!hasSeenUnlockFlow && tutorialStep === 0 && level >= 2 && (prevLevel === null || prevLevel < 2)) {
      localStorage.setItem(unlockSeenKey, "true");
      setTutorialStep(10);
    }

    // Show the Skills unlock flow when the player reaches level 4.
    const hasSeenSkillsUnlock = localStorage.getItem(skillsUnlockSeenKey);
    if (!hasSeenSkillsUnlock && tutorialStep === 0 && level >= 4 && (prevLevel === null || prevLevel < 4)) {
      localStorage.setItem(skillsUnlockSeenKey, "true");
      setTutorialStep(12);
    }

    if (previousLevelRef.current === null) {
      previousLevelRef.current = level;
      return;
    }

    if (prevLevel !== null && prevLevel < 2 && level >= 2) {
      if (!hasSeenUnlockFlow && tutorialStep === 0) {
        localStorage.setItem(unlockSeenKey, "true");
        setTutorialStep(10);
      }
    }

    if (prevLevel !== null && prevLevel < 4 && level >= 4) {
      if (!hasSeenSkillsUnlock && tutorialStep === 0) {
        localStorage.setItem(skillsUnlockSeenKey, "true");
        setTutorialStep(12);
      }
    }

    previousLevelRef.current = level;
  }, [isBootstrapping, level, showIntro, tutorialStep, activeFarmId]);

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
        
        if (res.ok) {
          const data = await res.json();
          const match = data.message?.match(/Harvested (\d+)/);
          const yieldAmount = match ? parseInt(match[1], 10) : 1;

          setInventory(prev => {
            const copy = [...prev];
            const idx = copy.findIndex(i => i.cropType === crop.type);
            if (idx >= 0) copy[idx].quantity += yieldAmount;
            else copy.push({ id: `temp-${Date.now()}`, cropType: crop.type, quantity: yieldAmount });
            return copy;
          });

          // Optimistic RPG XP bump
          setTotalXp(prev => {
            const nextTotal = prev + 10;
            const progress = calculateLevelProgress(nextTotal);
            setLevel(progress.level);
            return nextTotal;
          });
          setMessage(data.message || `Harvested ${CROPS[crop.type]?.name || crop.type}!`);
        } else {
          const data = await res.json();
          setMessage(data.message || data.error || "Harvest failed");
          void loadStatus({ force: true });
        }
        // Sync real state in background
        void loadStatus();
      }
    } catch {
      setMessage("Action failed");
      void loadStatus({ force: true });
    } finally {
      setIsActionPending(false);
    }
  };

  // ---------------- HARVEST ALL ----------------

  const handleHarvestAll = async () => {
    if (isActionPending) return;
    const readyCrops = crops.filter(c => fmtTimer(c).ready);
    if (readyCrops.length === 0) return;

    setIsActionPending(true);
    const harvestedTypes: Record<string, number> = {};
    let xpGained = 0;

    try {
      // Optimistically update UI for all crops
      setCrops(prev => prev.filter(c => !fmtTimer(c).ready));
      
      for (const crop of readyCrops) {
        harvestedTypes[crop.type] = (harvestedTypes[crop.type] || 0) + 1;
        xpGained += 5;

        // Fire off backend requests concurrently for speed
        walletFetch("/api/harvest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileIndex: crop.tileIndex }),
        }).catch(console.error);
      }
      
      // Optimistic inventory update
      setInventory(prev => {
        let newInv = [...prev];
        for (const [cType, qty] of Object.entries(harvestedTypes)) {
          const existing = newInv.find(i => i.cropType === cType);
          if (existing) {
            newInv = newInv.map(i => i.cropType === cType ? { ...i, quantity: i.quantity + qty } : i);
          } else {
            newInv.push({ id: `inv-temp-${cType}`, cropType: cType, quantity: qty });
          }
        }
        return newInv;
      });

      // Optimistic XP update
      setTotalXp(prev => {
        const nextTotal = prev + xpGained;
        const progress = calculateLevelProgress(nextTotal);
        setLevel(progress.level);
        return nextTotal;
      });

      setMessage(`Harvested ${readyCrops.length} crops!`);
    } catch {
      setMessage("Harvest All failed");
    } finally {
      setIsActionPending(false);
      // Sync real state after requests settle
      setTimeout(() => void loadStatus({ force: true }), 1500);
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
  const warehouseItems = inventory.filter((item) => item.quantity > 0);

  useEffect(() => {
    const keys = Object.keys(CROPS).filter(k => !CROPS[k].itemType || CROPS[k].itemType === "crop");
    const firstAllowed = keys.find((k) => {
      const cfg = CROPS[k] as any;
      if (cfg.unlockLevel && (level ?? 1) < cfg.unlockLevel) return false;
      return true;
    });
    if (firstAllowed && !Object.keys(CROPS).includes(selectedCrop)) setSelectedCrop(firstAllowed);
    if (firstAllowed && selectedCrop) {
      const selCfg = CROPS[selectedCrop] as any;
      const selAllowed = !(selCfg.unlockLevel && (level ?? 1) < selCfg.unlockLevel);
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
    { icon: "🧠", label: "Skills",           href: "/skills",     active: false },
    { icon: "🏆", label: "Achievements",      href: null,           active: false },
    { icon: "👑", label: "Leaderboard",       href: "/leaderboard", active: false },
  ];

  const eventImages: Record<string, string> = {
    "Peaceful Times": "/Peacfultime.png",
    "The Titanic Era": "/Titanic-era.png",
  };
  const eventImage = event?.name ? eventImages[event.name] : undefined;

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden" style={{fontFamily:"'Share Tech Mono','Courier New','Apple Color Emoji','Segoe UI Emoji',monospace",fontSize:"13px"}}>

      {/* LOADING */}
      {isBootstrapping && !showIntro && (
        <div className="fixed inset-0 z-50 bg-[rgba(var(--background-rgb),0.88)] flex items-center justify-center">
          <div className="border border-zinc-600 px-8 py-4 text-green-400 text-sm font-bold tracking-widest">[ LOADING CHRONOFARM... ]</div>
        </div>
      )}

      {/* INTRO SEQUENCE */}
      {showIntro && (
        <IntroSequence onComplete={() => {
          localStorage.setItem("chronofarm_intro_seen", "true");
          setShowIntro(false);
        }} />
      )}

      {/* TUTORIAL OVERLAY */}
      {tutorialStep > 0 && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-end justify-center pb-24 transition-opacity pointer-events-none">
          <div className="bg-[#0a0f0a] border border-emerald-500/50 p-6 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] max-w-lg w-full text-center flex flex-col gap-5 pointer-events-auto">
            <div className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-xs flex items-center justify-center gap-2">
              <Star className="w-4 h-4" /> NEWBIE GUIDE
            </div>
            <div className="text-zinc-200 text-sm leading-relaxed tracking-wide min-h-[3rem]">
              {tutorialStep === 1 && "Welcome to your Main Farm. This is where you will plant, grow, and harvest crops to build your empire."}
              {tutorialStep === 2 && "First, we need something to plant. Click the SEEDS button to open your inventory."}
              {tutorialStep === 3 && "Great! Now select WHEAT from your available seeds."}
              {tutorialStep === 4 && "Click the first empty plot on the grid to plant your Wheat."}
              {tutorialStep === 5 && "Wheat grows quickly. Keep an eye on the timer... Time is money!"}
              {tutorialStep === 6 && "It's ready! Click the fully grown Wheat to harvest it."}
              {tutorialStep === 7 && "Nice harvest! Your crops are automatically stored in your Warehouse on the right. You can sell them at the Market or use them to craft upgrades later."}
              {tutorialStep === 8 && "Notice the Timeline at the bottom. As you level up, you can Advance Time to reach new eras and trigger global events."}
              {tutorialStep === 9 && "Check your Level and EXP in the top bar. Keep farming to level up! Remember: Some features remain locked until you prove yourself."}
              {tutorialStep === 10 && "Level 2 reached! Marketplace is now unlocked. We'll highlight the Market button for you."}
                {tutorialStep === 11 && "Click the glowing MARKET button in Quick Actions to enter the Marketplace. Its full guide will open there."}
                {tutorialStep === 12 && "Level 4 reached! Skills are now unlocked. You can choose how your player progresses from here."}
                {tutorialStep === 13 && "Click the glowing SKILLS button in Quick Actions to open the skills menu."}
                {tutorialStep === 14 && "Inside Skills, choose Farm to return here or Mining to enter the mining page."}
            </div>
              {(tutorialStep === 1 || tutorialStep === 7 || tutorialStep === 8 || tutorialStep === 9 || tutorialStep === 10 || tutorialStep === 12) && (
              <button className="btn-game btn-game-green self-center text-xs px-8 py-2" onClick={() => {
                if (tutorialStep === 9) {
                   setTutorialStep(0);
                   if (activeFarmId) {
                    localStorage.setItem(`chronofarm_tutorial_seen_${activeFarmId}`, "true");
                   }
                   localStorage.setItem("chronofarm_tutorial_seen", "true");
                } else if (tutorialStep === 10) {
                   setTutorialStep(11);
                } else if (tutorialStep === 12) {
                   setTutorialStep(13);
                 } else {
                   setTutorialStep(tutorialStep + 1);
                }
              }}>{tutorialStep === 9 ? "START FARMING" : tutorialStep === 10 ? "SHOW MARKET BUTTON" : tutorialStep === 12 ? "SHOW SKILLS BUTTON" : "NEXT"}</button>
            )}
          </div>
        </div>
      )}

      <header className={`flex items-center gap-4 px-4 py-2 border-b border-zinc-700 shrink-0 bg-[var(--panel-bg)] ${tutorialStep === 9 ? "z-50 relative pointer-events-auto ring-2 ring-emerald-400" : "z-10"}`}>
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
              const isLocked = (() => {
                if (n.label === "The Farm") return false;
                if (n.label === "Marketplace") return level < 2;
                if (n.label === "Engineering") return level < 5;
                if (n.label === "Skills") return level < 4;
                return level < 3;
              })();
              const cls = `flex items-center gap-2 px-3 py-2 text-sm transition-all ${
                isLocked
                  ? "text-zinc-600 border-l-2 border-transparent bg-zinc-950/20 cursor-not-allowed"
                  : n.active 
                    ? "text-green-400 border-l-2 border-green-500 bg-green-950/10 cursor-pointer" 
                    : "text-zinc-400 border-l-2 border-transparent hover:text-zinc-200 hover:bg-[rgba(var(--card-bg-rgb),0.7)] cursor-pointer"
              }`;
              const inner = (
                <>
                  <span>{n.icon}</span>
                  <span className="flex-1">{n.label}</span>
                  {isLocked && <Lock className="w-3 h-3 text-red-900" />}
                </>
              );
              
              if (isLocked) return <div key={n.label} className={cls}>{inner}</div>;
              
              if (n.href && !n.active) return <Link key={n.label} href={n.href}><div className={cls}>{inner}</div></Link>;
              return <div key={n.label} className={cls}>{inner}</div>;
            })}
          </nav>
          <div className="border-t border-zinc-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 border border-zinc-600 flex items-center justify-center bg-[var(--card-bg)]">👨‍🌾</div>
              <div><div className="text-[10px] text-zinc-500">Farmer</div><div className="text-[11px] font-bold">ChronoMaster</div></div>
            </div>
            
            {/* RPG XP Bar Sidebar */}
            <div className="mb-2">
              <div className="flex justify-between text-[9px] mb-1">
                <span className="text-zinc-500 font-bold">LVL {calculateLevelProgress(totalXp).level}</span>
                <span className="text-zinc-400 font-mono">{calculateLevelProgress(totalXp).currentXp} / {calculateLevelProgress(totalXp).nextLevelXp}</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(calculateLevelProgress(totalXp).currentXp / calculateLevelProgress(totalXp).nextLevelXp) * 100}%` }} />
              </div>
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
              <span className="border border-zinc-700 px-2 py-0.5 text-green-500">XP {totalXp}</span>
            </div>
          </div>

          {showMap ? (
            <div className="flex-1 overflow-y-auto bg-[#0a0f0a] p-8 custom-scrollbar relative flex flex-col z-50">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <button onClick={() => setShowMap(false)} className="text-[#cda66d] border border-[#cda66d]/30 hover:bg-[#cda66d]/10 px-4 py-2 rounded flex items-center gap-2 text-xs font-bold tracking-widest transition-colors">
                    <ChevronLeft className="w-4 h-4" /> BACK
                  </button>
                  <h1 className="text-2xl font-serif text-zinc-100 tracking-wider">SKILLS</h1>
                </div>
                
                {/* Stats */}
                <div className="flex bg-[#111a13] border border-zinc-800 rounded-lg p-1">
                  <div className="px-4 py-1 text-center border-r border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Level</div>
                    <div className="text-emerald-500 font-bold text-sm">
                      <Hexagon className="w-4 h-4 inline-block mr-1"/>{level}
                    </div>
                  </div>
                  <div className="px-4 py-1 text-center border-r border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Credits</div>
                    <div className="text-[#cda66d] font-bold text-sm">${money}</div>
                  </div>
                  <div className="px-4 py-1 text-center">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Status</div>
                    <div className="text-emerald-500 font-bold text-sm">IDLE</div>
                  </div>
                </div>
              </div>

              {/* Sub-header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(205,166,109,0.15)]">
                    <Globe className="w-6 h-6 text-[#cda66d]" />
                  </div>
                  <div>
                    <h2 className="text-[#cda66d] font-serif text-lg tracking-wide mb-1">EXPLORE THE WORLD</h2>
                    <p className="text-xs text-zinc-400 max-w-md leading-relaxed">Discover new markets, rare resources, and unique opportunities across different regions.</p>
                  </div>
                </div>

                <div className="bg-[#111a13] border border-zinc-800 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-900/30 flex items-center justify-center border border-emerald-700/50">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-[9px] text-emerald-500 uppercase tracking-widest font-bold mb-0.5">ACTIVE LOCATION</div>
                    <div className="text-zinc-200 text-sm font-serif tracking-wider">{currentRegion?.name || "Unknown"}</div>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-3 gap-6 mb-8 flex-1">
                {regions.map(r => {
                  const maxLv = farmsState.length ? Math.max(...farmsState.map(f => f.level ?? 1)) : level;
                  const locked = r.unlockLevel && maxLv < r.unlockLevel;
                  const isCurrent = r.id === currentRegion?.id;
                  
                  // Styling based on continent
                  let theme = "zinc";
                  let themeHex = "#71717a";
                  let btnColor = "";
                  let ribbonColor = "";
                  let bgUrl = "";
                  let diff = "Easy";
                  let diffColor = "text-emerald-500";
                  let bgImg = "";
                  
                  if (r.name.includes("Europe")) {
                    theme = "emerald";
                    themeHex = "#10b981";
                    btnColor = "bg-gradient-to-b from-[#113a21] to-[#0a2012] hover:from-[#154d2c] hover:to-[#113a21] border-[#10b981]/30 text-emerald-100";
                    ribbonColor = "bg-[#1f7b4e]";
                    diff = "Easy";
                    diffColor = "text-emerald-500";
                    bgUrl = "radial-gradient(circle at center, #1b3021 0%, #0a0f0a 100%)";
                    bgImg = "url('/map-europe.jpg')"; // Placeholder
                  } else if (r.name.includes("America")) {
                    theme = "blue";
                    themeHex = "#3b82f6";
                    btnColor = "bg-gradient-to-b from-[#1e3a5f] to-[#0f1f33] hover:from-[#2a4d7a] hover:to-[#1e3a5f] border-blue-500/30 text-blue-100";
                    ribbonColor = "bg-[#3b82f6]";
                    diff = "Easy";
                    diffColor = "text-emerald-500";
                    bgUrl = "radial-gradient(circle at center, #14243b 0%, #0a0f0a 100%)";
                    bgImg = "url('/map-americas.jpg')"; // Placeholder
                  } else {
                    theme = "purple";
                    themeHex = "#a855f7";
                    btnColor = "bg-gradient-to-b from-[#3a1d52] to-[#20102e] hover:from-[#4d286d] hover:to-[#3a1d52] border-purple-500/30 text-purple-100";
                    ribbonColor = "bg-[#7e22ce]";
                    diff = "Medium";
                    diffColor = "text-[#cda66d]";
                    bgUrl = "radial-gradient(circle at center, #2e1a3b 0%, #0a0f0a 100%)";
                    bgImg = "url('/map-asia.jpg')"; // Placeholder
                  }

                  return (
                    <div key={r.id} className={`relative flex flex-col rounded-xl border transition-all ${isCurrent ? "border-[var(--highlight)] shadow-[0_0_15px_rgba(205,166,109,0.15)]" : "border-zinc-800 bg-[#111a13]"} overflow-hidden`} style={isCurrent ? {borderColor: themeHex, boxShadow: `0 0 20px ${themeHex}33`} : {}}>
                      
                      {/* Ribbon */}
                      <div className="absolute top-0 right-4 w-8 h-12 flex items-start justify-center pt-2 z-20">
                        <div className={`absolute inset-0 ${ribbonColor} shadow-lg`} style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)" }}></div>
                        <Star className="w-4 h-4 text-white fill-white relative z-30" />
                      </div>

                      {/* Header Area */}
                      <div className="p-6 relative h-48 flex flex-col justify-between" style={{ background: bgImg !== "url('')" ? bgImg : bgUrl, backgroundSize: "cover", backgroundPosition: "center" }}>
                        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#111a13] z-0" />
                        
                        <div className="relative z-10 pt-2">
                          <div className={`text-[9px] font-bold tracking-widest uppercase mb-1 text-${theme}-400`} style={{ color: themeHex }}>{r.continent || r.name.split(" ")[0]}</div>
                          <h3 className="text-3xl font-serif text-white mb-2 tracking-wide">{r.name}</h3>
                          <p className="text-xs text-zinc-300 leading-relaxed max-w-[85%] min-h-[40px] drop-shadow-md">{r.description}</p>
                        </div>
                        
                        <div className="relative z-10 flex items-end">
                          {isCurrent && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a2012]/80 border border-[#10b981]/40 text-[9px] text-emerald-400 font-bold tracking-widest uppercase backdrop-blur-sm">
                              <MapPin className="w-3.5 h-3.5" /> YOUR CURRENT LOCATION
                            </div>
                          )}
                          {!isCurrent && locked && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-[9px] text-zinc-400 font-bold tracking-widest uppercase backdrop-blur-sm">
                              <Lock className="w-3.5 h-3.5" /> LOCKED — LEVEL {r.unlockLevel}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-6 bg-[#111a13] flex flex-col z-10 relative">
                        {/* Glow overlap effect */}
                        <div className="absolute top-0 left-0 w-full h-1" style={{background: `linear-gradient(90deg, transparent, ${themeHex}44, transparent)`}} />
                        
                        <div className={`text-[9px] font-bold tracking-widest uppercase text-${theme}-500 mb-4`} style={{ color: themeHex }}>REGION HIGHLIGHTS</div>
                        
                        <div className="grid grid-cols-3 gap-3 mb-6 flex-1">
                          <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center shadow-inner">
                              <Settings className={`w-4 h-4 text-${theme}-400`} style={{ color: themeHex }} />
                            </div>
                            <div className="text-[9px] text-zinc-300 font-bold leading-tight">Advanced Machinery</div>
                            <div className="text-[8px] text-zinc-500 leading-tight pr-2">High demand for industrial equipment</div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center shadow-inner">
                              <TrendingUp className={`w-4 h-4 text-${theme}-400`} style={{ color: themeHex }} />
                            </div>
                            <div className="text-[9px] text-zinc-300 font-bold leading-tight">Stable Economy</div>
                            <div className="text-[8px] text-zinc-500 leading-tight pr-2">Balanced market conditions</div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center shadow-inner">
                              <Diamond className={`w-4 h-4 text-${theme}-400`} style={{ color: themeHex }} />
                            </div>
                            <div className="text-[9px] text-zinc-300 font-bold leading-tight">Rich Resources</div>
                            <div className="text-[8px] text-zinc-500 leading-tight pr-2">Abundant in iron and coal</div>
                          </div>
                        </div>

                        <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-4">
                          <div className="flex items-end justify-between px-2">
                            <div>
                              <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1.5">TRAVEL TIME</div>
                              <div className="text-xs text-zinc-300 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#cda66d]"/> 12h 30m</div>
                            </div>
                            <div>
                              <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1.5">TRAVEL COST</div>
                              <div className="text-xs text-zinc-300 flex items-center gap-1.5"><CircleDollarSign className="w-3.5 h-3.5 text-[#cda66d]"/> $150</div>
                            </div>
                            <div>
                              <div className="text-[8px] text-zinc-500 uppercase tracking-widest mb-1.5 text-right">DIFFICULTY</div>
                              <div className={`text-xs font-bold ${diffColor} text-right`}>{diff}</div>
                            </div>
                          </div>

                          {isCurrent ? (
                            <button className="w-full py-3.5 rounded-lg bg-gradient-to-b from-[#113a21] to-[#0a2012] border border-[#10b981]/30 text-emerald-500 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 shadow-[inset_0_0_15px_rgba(16,185,129,0.1)] pointer-events-none">
                              <MapPin className="w-4 h-4" /> CURRENT LOCATION
                            </button>
                          ) : locked ? (
                            <button disabled className="w-full py-3.5 rounded-lg bg-[#0a0f0a] border border-zinc-800 text-zinc-600 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 opacity-70">
                              <Lock className="w-4 h-4" /> INSUFFICIENT CLEARANCE
                            </button>
                          ) : (
                            <button 
                              onClick={() => travelTo(r.id)} 
                              className={`w-full py-3.5 rounded-lg ${btnColor} border text-[10px] font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all shadow-[inset_0_1px_rgba(255,255,255,0.1)]`}
                            >
                              <Plane className="w-4 h-4" /> TRAVEL HERE
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer Tip */}
              <div className="w-full bg-gradient-to-r from-[#111a13] to-[#080d09] border border-zinc-800 rounded-xl p-5 flex items-center gap-6 relative overflow-hidden shrink-0 shadow-lg">
                <div className="absolute inset-y-0 right-0 w-1/3 bg-[url('/ship-silhouette.png')] bg-contain bg-no-repeat bg-right opacity-10 pointer-events-none" />
                
                <div className="w-12 h-12 rounded-full border border-zinc-700 bg-[#050805] flex items-center justify-center shrink-0 z-10 shadow-inner">
                  <Compass className="w-6 h-6 text-[#cda66d]" />
                </div>
                <div className="z-10">
                  <div className="text-[#cda66d] text-[10px] font-bold tracking-[0.2em] uppercase mb-1">TRAVEL TIP</div>
                  <div className="text-zinc-400 text-xs tracking-wide">Different regions offer unique resources and market opportunities. Choose your destination wisely!</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Farm grid */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-[var(--background)] bg-[url('/farm-bg.png')] bg-cover bg-center">
                <div className="absolute inset-0 bg-[rgba(var(--background-rgb),0.45)] pointer-events-none" />
                <div className={`absolute left-4 top-4 flex flex-col items-start gap-2 ${tutorialStep === 2 ? "z-50 relative pointer-events-auto" : "z-20"}`}>
                  <button
                    onClick={() => {
                      setShowSeedPortal(prev => !prev);
                      if (tutorialStep === 2) setTutorialStep(3);
                    }}
                    className={`btn-game btn-game-green ${tutorialStep === 2 ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black animate-pulse" : ""}`}
                    style={{fontSize:"10px",padding:"6px 10px"}}
                  >
                    SEEDS
                  </button>
                  <div className="text-[9px] text-zinc-300 bg-[rgba(var(--panel-bg-rgb),0.8)] border border-zinc-700 rounded px-2 py-1">
                    Selected: <span className="text-emerald-300">{CROPS[selectedCrop]?.name || selectedCrop}</span>
                  </div>
                </div>
                {showSeedPortal && (
                  <div className={`absolute left-4 top-16 w-56 h-56 bg-[rgba(var(--panel-bg-rgb),0.95)] border border-emerald-700/40 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] p-2 flex flex-col ${tutorialStep === 3 ? "z-50 relative pointer-events-auto" : "z-20"}`}>
                    <div className="text-[9px] text-emerald-300 uppercase tracking-widest mb-2">Seeds</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 gap-2">
                        {Object.keys(CROPS).filter(k => !CROPS[k].itemType || CROPS[k].itemType === "crop").map(k => {
                          const cfg = CROPS[k] as any;
                          const dis = cfg.unlockLevel && level < cfg.unlockLevel;
                          const isTutTarget = tutorialStep === 3 && k === "WHEAT";
                          return (
                            <button
                              key={k}
                              onClick={() => {
                                if (!dis) setSelectedCrop(k);
                                if (isTutTarget) {
                                  setShowSeedPortal(false);
                                  setTutorialStep(4);
                                }
                              }}
                              disabled={!!dis || (tutorialStep === 3 && !isTutTarget)}
                              className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[10px] transition-all ${isTutTarget ? "ring-2 ring-emerald-400 animate-pulse border-emerald-500" : ""} ${selectedCrop === k ? "border-emerald-500 text-emerald-200 bg-emerald-950/40" : dis ? "border-zinc-800 text-zinc-600 bg-zinc-950/50 cursor-not-allowed opacity-60" : "border-zinc-700 text-zinc-300 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/60"}`}
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
                <div className={`w-full max-w-2xl relative ${tutorialStep === 1 ? "z-50 pointer-events-auto" : "z-10"}`}>
                  <div className="text-[9px] text-zinc-600 text-center uppercase tracking-widest mb-4">FARM VIEW</div>
                  <div className={`p-4 md:p-5 mb-4 rounded-lg bg-[radial-gradient(circle_at_20%_20%,#5f8d2f_0%,#416625_45%,#2b4a17_100%)] ring-4 ring-[#2f4c13] shadow-[inset_0_0_30px_rgba(0,0,0,0.6)] ${tutorialStep === 1 ? "ring-offset-2 ring-offset-black ring-emerald-500" : ""}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Array.from({length: 9}).map((_, idx) => {
                        const tile = tiles.find(t => t.index === idx);
                        const crop = crops.find(c => c.tileIndex === idx);
                        const timer = crop ? fmtTimer(crop) : null;
                        const isTutTarget = (tutorialStep === 4 || tutorialStep === 5 || tutorialStep === 6) && idx === 0;
                        const tileFrame = `aspect-[5/4] cursor-pointer group transition-all ${isTutTarget ? "z-50 relative pointer-events-auto ring-4 ring-emerald-400 ring-offset-2 ring-offset-black rounded-md animate-pulse" : (tutorialStep > 1 && tutorialStep < 7) ? "pointer-events-none opacity-40" : ""}`;
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
                    <button onClick={handleHarvestAll}
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

  <div className="px-3 py-2 border-b border-zinc-700 text-[11px] text-zinc-500 uppercase tracking-widest shrink-0"
    style={{fontFamily:"'Press Start 2P',monospace",fontSize:"9px"}}
  >
    RIGHT PANEL
  </div>

  {/* Global Event */}
  {event && (
    <div className="border-b border-zinc-700 p-3 shrink-0">
      <div className="text-[10px] text-yellow-500 uppercase tracking-widest mb-1.5">
        GLOBAL EVENT
      </div>

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
              <div className="text-[11px] font-bold text-yellow-300">
                "{event.name}"
              </div>

              <div className="text-[10px] text-zinc-200 mt-0.5 leading-snug">
                {event.description}
              </div>

              {event.effects.priceMultiplier && (
                <div className="text-[10px] text-yellow-400 mt-1">
                  Market Boost +
                  {((event.effects.priceMultiplier - 1) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-yellow-700/30 p-2">
            <div className="text-sm font-bold text-yellow-300">
              "{event.name}"
            </div>

            <div className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
              {event.description}
            </div>

            {event.effects.priceMultiplier && (
              <div className="text-[10px] text-yellow-500 mt-1">
                Market Boost +
                {((event.effects.priceMultiplier - 1) * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )}

  {/* Market Panel */}
  {npc && marketPrices.length > 0 && (
    <div className="border-b border-zinc-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
          MARKET PANEL
        </div>

        <span className="text-[9px] text-zinc-600">
          {npc.name}
        </span>
      </div>

      <div className="rounded-md border border-zinc-800 bg-[rgba(var(--panel-bg-rgb),0.7)] p-2 space-y-1 max-h-56 overflow-y-auto custom-scrollbar">
        {marketPrices.map((p) => {
          const d = p.demand / (p.supply + p.demand + 0.001);

          const badge =
            d > 0.65
              ? { l: "VERY HIGH", c: "text-purple-400" }
              : d > 0.5
              ? { l: "HIGH", c: "text-green-400" }
              : d > 0.35
              ? { l: "MEDIUM", c: "text-yellow-400" }
              : { l: "LOW", c: "text-red-400" };

          return (
            <div
              key={p.id}
              className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded hover:bg-[rgba(var(--card-bg-rgb),0.7)]"
            >
              <span>{CROPS[p.cropType]?.emoji}</span>

              <span className="text-zinc-300 flex-1">
                {p.cropType}
              </span>

              <span className="text-green-400 font-bold">
                ${p.price}
              </span>

              <span className={`text-[9px] ${badge.c}`}>
                {badge.l}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Warehouse */}
  <div className={`border-b border-zinc-700 p-3 shrink-0 ${tutorialStep === 7 ? "z-50 relative pointer-events-auto ring-2 ring-emerald-400" : ""}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest">
        WAREHOUSE
      </div>

      <span className="text-[9px] text-zinc-600">
        {warehouseItems.length} items
      </span>
    </div>

    {warehouseItems.length === 0 ? (
      <div className="text-[10px] text-zinc-600 border border-zinc-800 rounded p-2 text-center">
        EMPTY
      </div>
    ) : (
      <div className="rounded-md border border-zinc-800 bg-[rgba(var(--panel-bg-rgb),0.7)] p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
        {warehouseItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded hover:bg-[rgba(var(--card-bg-rgb),0.7)]"
          >
            <span>{CROPS[item.cropType]?.emoji}</span>

            <span className="text-zinc-300 flex-1">
              {CROPS[item.cropType]?.name || item.cropType}
            </span>

            <span className="text-yellow-400 font-bold">
              x{item.quantity}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* Quick Actions */}
  <div className="p-3 shrink-0">
    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2 flex items-center justify-between">
      QUICK ACTIONS
      {level === 1 && <Lock className="w-3 h-3 text-red-900" />}
    </div>

    <div className="grid grid-cols-2 gap-1.5">
      {level < 5 ? (
        <button disabled className="btn-game btn-game-dark w-full opacity-50 cursor-not-allowed" style={{fontSize:"10px",padding:"8px 6px"}}>⚙️ Crafting</button>
      ) : (
        <Link href="/crafting" className="btn-game btn-game-dark w-full" style={{fontSize:"10px",padding:"8px 6px"}}>⚙️ Crafting</Link>
      )}

      {level < 2 ? (
        <button disabled className="btn-game btn-game-dark w-full opacity-50 cursor-not-allowed" style={{fontSize:"10px",padding:"8px 6px"}}>🏪 Market</button>
      ) : (
        <Link
          href="/marketplace"
          className={`btn-game btn-game-dark w-full ${tutorialStep === 11 ? "z-50 relative pointer-events-auto ring-4 ring-emerald-400 ring-offset-2 ring-offset-black animate-pulse" : ""}`}
          style={{fontSize:"10px",padding:"8px 6px"}}
          onClick={() => {
            if (tutorialStep === 11) {
              if (activeFarmId) {
                localStorage.setItem(`chronofarm_marketplace_pending_guide_${activeFarmId}`, "true");
              }
              setTutorialStep(0);
            }
          }}
        >
          🏪 Market
        </Link>
      )}

      {level < 4 ? (
        <button disabled className="btn-game btn-game-dark w-full opacity-50 cursor-not-allowed" style={{fontSize:"10px",padding:"8px 6px"}}>🧠 Skills</button>
      ) : (
        <Link
          href="/skills"
          className={`btn-game btn-game-dark w-full ${tutorialStep === 13 ? "z-50 relative pointer-events-auto ring-4 ring-emerald-400 ring-offset-2 ring-offset-black animate-pulse" : ""}`}
          style={{fontSize:"10px",padding:"8px 6px"}}
          onClick={() => {
            if (tutorialStep === 13) {
              if (activeFarmId) {
                localStorage.setItem(`chronofarm_skills_pending_guide_${activeFarmId}`, "true");
              }
              setTutorialStep(0);
            }
          }}
        >
          🧠 Skills
        </Link>
      )}

      {level < 3 ? (
        <button disabled className="btn-game btn-game-dark w-full opacity-50 cursor-not-allowed" style={{fontSize:"10px",padding:"8px 6px"}}>💬 Chat</button>
      ) : (
        <Link
          href="/section"
          className="btn-game btn-game-dark w-full"
          style={{fontSize:"10px",padding:"8px 6px"}}
        >
          💬 Chat
        </Link>
      )}
    </div>
  </div>

</aside>
      </div>

      {/* ——— BOTTOM ROW ——— */}
      <div
        className="flex border-t border-zinc-700 shrink-0 bg-[var(--panel-bg)]"
        style={{ height: "130px" }}
      >

        {/* Global Chat */}
        <div className="flex-1 border-r border-zinc-700 flex flex-col overflow-hidden">
          <div
            className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0"
            style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "7px" }}
          >
            GLOBAL CHAT
          </div>

          <div className="flex-1 px-3 py-2 overflow-y-auto custom-scrollbar flex flex-col justify-end space-y-2">
            {messages.slice(-3).map((msg, i) => (
              <div key={msg.id || i} className="text-[9px] flex flex-col gap-0.5 border-b border-zinc-800/30 pb-1">
                <span className={msg.displayName === "SYSTEM" ? "text-emerald-500 font-bold" : "text-[var(--highlight)] font-bold"}>{msg.displayName}</span>
                <span className={msg.displayName === "SYSTEM" ? "text-emerald-400 italic" : "text-zinc-400"}>{msg.message}</span>
              </div>
            ))}
            {messages.length === 0 && <div className="text-[9px] text-zinc-600 italic">No communications.</div>}
          </div>

          <div className="border-t border-zinc-800 px-3 py-1 shrink-0">
            <button
              onClick={() => setShowChatModal(true)}
              className="btn-game btn-game-dark w-full text-left"
              style={{ fontSize: "8px", padding: "4px 8px" }}
            >
              💭 OPEN CHAT
            </button>
          </div>
        </div>

        {/* Time Travel */}
        <div className={`flex-1 border-r border-zinc-700 flex flex-col ${tutorialStep === 8 ? "z-50 relative pointer-events-auto ring-2 ring-emerald-400" : ""}`}>
          <div
            className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0"
            style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "7px" }}
          >
            TIME TRAVEL
          </div>

          <div className="flex-1 flex items-center justify-between px-4">
            <div>
              <div className="text-[9px] text-zinc-500 mb-1">
                Current Era →{" "}
                <span className="text-indigo-400 font-bold">
                  {year}
                </span>
              </div>

              {nextEraEntry && (
                <div className="text-[9px] text-zinc-500 mb-2">
                  Next Era →{" "}
                  <span className="text-purple-400 font-bold">
                    {nextEraEntry.year}
                  </span>
                </div>
              )}

              <div className="w-32 h-1.5 bg-[rgba(var(--card-bg-rgb),0.7)] overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{
                    width: `${(calculateLevelProgress(totalXp).currentXp / calculateLevelProgress(totalXp).nextLevelXp) * 100}%`,
                  }}
                />
              </div>

              <div className="text-[8px] text-zinc-600 mt-0.5">
                {calculateLevelProgress(totalXp).currentXp}/{calculateLevelProgress(totalXp).nextLevelXp} XP to Next Era
              </div>
            </div>

            <button
              onClick={advanceTime}
              className="btn-game btn-game-indigo"
              style={{ fontSize: "9px" }}
            >
              ⏳ ADVANCE ERA
            </button>
          </div>
        </div>

        {/* Daily Rewards */}
        <div className="flex-1 flex flex-col">
          <div
            className="px-3 py-1.5 border-b border-zinc-800 text-[9px] text-zinc-500 uppercase tracking-widest shrink-0"
            style={{ fontFamily: "'Press Start 2P',monospace", fontSize: "7px" }}
          >
            DAILY REWARDS
          </div>

          <div className="flex-1 flex items-center px-3 gap-1.5">
            {[
              { day: 1, icon: "✅", label: "$500" },
              { day: 2, icon: "💎", label: "x10" },
              { day: 3, icon: "🌾", label: "x1" },
              { day: 4, icon: "⭐", label: "$1,000" },
              { day: 5, icon: "💰", label: "x20" },
              { day: 6, icon: "🎁", label: "x1" },
            ].map((r) => (
              <div
                key={r.day}
                className={`flex flex-col items-center border p-1.5 flex-1 ${
                  r.day === 1
                    ? "border-green-600 bg-green-950/20"
                    : "border-zinc-700"
                }`}
              >
                <div className="text-[8px] text-zinc-500">
                  Day {r.day}
                </div>

                <div className="text-base">{r.icon}</div>

                <div className="text-[7px] text-zinc-500">
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--panel-bg)] border border-[var(--game-border)] rounded-xl w-full max-w-xl shadow-[0_0_50px_rgba(214,168,95,0.15)] flex flex-col h-[600px] overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black/20 shrink-0">
              <h3 className="text-sm font-bold text-[var(--highlight)] tracking-widest uppercase flex items-center gap-2">
                <Globe className="w-4 h-4" /> GLOBAL CHAT
              </h3>
              <button onClick={() => setShowChatModal(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {messages.map((msg, i) => {
                const isSystem = msg.displayName === "SYSTEM";
                return (
                  <div key={msg.id || i} className="flex items-start gap-4 p-3 hover:bg-zinc-900/30 rounded-lg transition-colors border-b border-zinc-800/30">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${isSystem ? "bg-emerald-900/20 text-emerald-500 border-emerald-800" : "bg-[#111a13] border-zinc-700 text-lg shadow-inner"}`}>
                      {isSystem ? <Activity className="w-5 h-5" /> : "👨‍🌾"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-1">
                        <span className={`text-sm font-bold ${isSystem ? "text-emerald-500" : "text-[var(--highlight)]"} truncate`}>{msg.displayName}</span>
                        <span className="text-[10px] text-zinc-500 tracking-widest shrink-0">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${isSystem ? "text-emerald-400 italic" : "text-zinc-300"}`}>
                        {msg.message}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <div className="text-center text-zinc-500 text-xs italic tracking-widest uppercase py-10">No communications.</div>}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-[#0a0f0a] shrink-0">
              <div className="flex gap-3 relative">
                <textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Broadcast message..."
                  rows={1}
                  className="flex-1 bg-[rgba(255,255,255,0.03)] border border-zinc-700 focus:border-[var(--highlight)] text-zinc-200 text-sm rounded-lg px-4 py-3 outline-none resize-none overflow-hidden transition-colors"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatDraft.trim()}
                  className="bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed px-6 rounded-lg font-bold tracking-widest text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  SEND <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}