"use client";

import { useEffect, useState } from "react";
import { CROPS } from "@/lib/crops";

export default function FarmPage() {
  const [money, setMoney] = useState(0);
  const [year, setYear] = useState(1910);
  const [event, setEvent] = useState<any>(null);

  const [crops, setCrops] = useState<any[]>([]);
  const [tiles, setTiles] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  const [selectedCrop, setSelectedCrop] = useState("WHEAT");
  const [message, setMessage] = useState("");

  // ---------------- LOAD STATUS ----------------

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();

      setMoney(data.money);
      setYear(data.year);
      setEvent(data.event);
      setCrops(data.crops);
      setTiles(data.tiles);
      setInventory(data.inventory);
    } catch (err) {
      console.error("Failed to load status", err);
    }
  };

  useEffect(() => {
    loadStatus();

    const interval = setInterval(loadStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // ---------------- ADVANCE YEAR ----------------

  const advanceTime = async () => {
    const res = await fetch("/api/advance-time", {
      method: "POST",
    });

    const data = await res.json();
    setMessage(data.message);
    loadStatus();
  };

  // ---------------- TILE CLICK ----------------

  const handleTileClick = async (index: number) => {
    const tile = tiles.find((t) => t.index === index);

    if (!tile) return;

    try {
      // BUY TILE
      if (!tile.unlocked) {
        const res = await fetch("/api/buy-tile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tileIndex: index,
          }),
        });

        const data = await res.json();
        setMessage(data.message);
        loadStatus();
        return;
      }

      const crop = crops.find((c) => c.tileIndex === index);

      // PLANT
      if (!crop) {
        const res = await fetch("/api/plant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tileIndex: index,
            type: selectedCrop,
          }),
        });

        const data = await res.json();
        setMessage(data.message);
      }
      // HARVEST
      else {
        const res = await fetch("/api/harvest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tileIndex: index,
          }),
        });

        const data = await res.json();
        setMessage(data.message);
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cropType,
        quantity: 1,
      }),
    });

    const data = await res.json();
    setMessage(data.message);
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

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">CHRONOFARM</h1>
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-mono text-zinc-500">📅 YEAR: {year}</h2>
              <h2 className="text-xl font-mono text-green-500">💰 MONEY: ${money}</h2>
            </div>
          </div>
          <button
            onClick={advanceTime}
            className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-full font-bold transition-all shadow-lg shadow-purple-900/20 active:scale-95"
          >
            ⏩ Advance Year
          </button>
        </div>

        {event && (
          <div className="mb-8 p-4 bg-zinc-900 rounded-lg border-l-4 border-red-600 animate-pulse">
            <h3 className="font-bold text-red-500 mb-1 uppercase tracking-widest text-xs">⚠️ Historical Event</h3>
            <div className="text-xl font-serif italic mb-1">"{event.name}"</div>
            <div className="text-zinc-400 text-sm">{event.description}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            {/* Message */}
            <div className={`mb-4 min-h-[1.5rem] font-mono text-sm ${message.includes("failed") ? "text-red-400" : "text-blue-400"}`}>
              {message && <span>{">"} {message}</span>}
            </div>

            {/* Farm grid */}
            <div className="grid grid-cols-3 gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800 shadow-2xl">
              {Array.from({ length: 9 }).map((_, index) => {
                const tile = tiles.find((t) => t.index === index);
                const crop = crops.find((c) => c.tileIndex === index);

                if (tile && !tile.unlocked) {
                  const cost = (index + 1) * 20;
                  return (
                    <div
                      key={index}
                      onClick={() => handleTileClick(index)}
                      className="h-32 flex flex-col items-center justify-center rounded-lg cursor-pointer border-2 border-dashed border-zinc-800 bg-black hover:bg-zinc-800 hover:border-zinc-700 transition-all group"
                    >
                      <span className="text-2xl mb-1 grayscale group-hover:grayscale-0 transition-all">🔒</span>
                      <div className="text-[10px] uppercase font-bold text-zinc-600 group-hover:text-zinc-400">Unlock</div>
                      <div className="text-xs font-mono text-yellow-600">${cost}</div>
                    </div>
                  );
                }

                if (!crop) {
                  return (
                    <div
                      key={index}
                      onClick={() => handleTileClick(index)}
                      className="h-32 flex items-center justify-center rounded-lg cursor-pointer border-2 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-all shadow-inner"
                    >
                      <span className="text-3xl opacity-20">🟫</span>
                    </div>
                  );
                }

                const status = getStatus(crop);
                const isReady = status === "Ready";

                return (
                  <div
                    key={crop.id}
                    onClick={() => handleTileClick(index)}
                    className={`h-32 flex flex-col items-center justify-center rounded-lg cursor-pointer border-2 transition-all shadow-lg ${
                      isReady 
                        ? "bg-green-900/40 border-green-500 hover:bg-green-900/60 shadow-green-900/20" 
                        : "bg-yellow-900/20 border-yellow-800 hover:bg-yellow-900/30 shadow-yellow-900/10"
                    }`}
                  >
                    <span className={`text-4xl mb-2 ${isReady ? "animate-bounce" : "animate-pulse"}`}>
                      {CROPS[crop.type]?.emoji || "🌾"}
                    </span>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isReady ? "bg-green-500 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                      {status}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Initialize check */}
            {tiles.length === 0 && (
              <div className="mt-8 p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center shadow-2xl">
                <p className="mb-6 text-zinc-400 font-serif italic text-lg">"The soil is rich and the sun is high. Time to build your legacy."</p>
                <button
                  onClick={async () => {
                    const res = await fetch("/api/init");
                    const data = await res.json();
                    setMessage(data.message);
                    loadStatus();
                  }}
                  className="bg-green-600 hover:bg-green-500 px-10 py-4 rounded-full font-black text-xl transition-all shadow-lg shadow-green-900/40 active:scale-95"
                >
                  🌾 START YOUR FARM
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-8">
            {/* Crop selection */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl">
              <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest">Select Crop</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(CROPS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCrop(key)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      selectedCrop === key 
                        ? "bg-green-900/20 border-green-600 shadow-lg" 
                        : "bg-black border-zinc-800 hover:border-zinc-600 text-zinc-400"
                    }`}
                  >
                    <span className="text-2xl mb-1">{CROPS[key].emoji}</span>
                    <span className="text-[10px] font-bold">{CROPS[key].name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl flex-grow">
              <h3 className="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span>🎒 Inventory</span>
                <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[8px]">{inventory.reduce((a, b) => a + b.quantity, 0)} items</span>
              </h3>
              
              {inventory.length === 0 ? (
                <div className="text-zinc-600 text-sm italic py-4 text-center border-2 border-dashed border-zinc-800 rounded-lg">
                  Your warehouse is empty
                </div>
              ) : (
                <div className="space-y-2">
                  {inventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-black rounded-lg border border-zinc-800 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{CROPS[item.cropType]?.emoji || "🌾"}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-300">{item.cropType}</span>
                          <span className="text-[10px] text-zinc-500">Qty: {item.quantity}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => sellCrop(item.cropType)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 shadow-lg shadow-blue-900/20 active:scale-95"
                      >
                        SELL $
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}