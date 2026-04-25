"use client";

import { useEffect, useState } from "react";

type Crop = {
  id: string;
  type: string;
  readyAt: string;
  tileIndex: number;
};

export default function FarmPage() {
  const [money, setMoney] = useState(0);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    const res = await fetch("/api/status");
    const data = await res.json();

    setMoney(data.money);

    if (data.farms.length > 0) {
      setCrops(data.farms[0].crops);
    }
  };

  useEffect(() => {
    loadStatus();

    const interval = setInterval(() => {
      loadStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const plantCrop = async () => {
    const emptyIndex = Array.from({ length: 9 }).findIndex(
      (_, i) => !crops.some((c) => c.tileIndex === i)
    );
    if (emptyIndex === -1) {
      setMessage("No empty tiles!");
      return;
    }
    const res = await fetch("/api/plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileIndex: emptyIndex }),
    });

    const data = await res.json();

    setMessage(data.message);

    loadStatus();
  };

  const harvestCrop = async () => {
    const now = new Date();
    const readyCrop = crops.find(c => new Date(c.readyAt) <= now);
    if (!readyCrop) {
      setMessage("No crops ready!");
      return;
    }
    const res = await fetch("/api/harvest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tileIndex: readyCrop.tileIndex }),
    });

    const data = await res.json();

    setMessage(data.message);

    loadStatus();
  };

  const getStatus = (crop: Crop) => {
    const readyTime = new Date(crop.readyAt);
    const now = new Date();

    if (readyTime <= now) return "Ready";

    const seconds = Math.ceil(
      (readyTime.getTime() - now.getTime()) / 1000
    );

    return `Growing ${seconds}s`;
  };

  const tiles = Array.from({ length: 9 });

  return (
    <div className="min-h-screen bg-black text-white p-8">

      <h1 className="text-3xl font-bold mb-4">
        Europe Farm — 1910
      </h1>

      <h2 className="text-xl mb-6">
        💰 Money: {money}
      </h2>

      <div className="flex gap-4 mb-6">

        <button
          onClick={plantCrop}
          className="bg-green-600 px-4 py-2 rounded"
        >
          🌾 Plant Wheat
        </button>

        <button
          onClick={harvestCrop}
          className="bg-yellow-600 px-4 py-2 rounded"
        >
          🧺 Harvest Ready
        </button>

      </div>

      <div className="text-blue-300 mb-6">
        {message}
      </div>

      <div className="grid grid-cols-3 gap-4">

        {tiles.map((_, index) => {
          const crop = crops.find((c) => c.tileIndex === index);

          if (!crop) {
            return (
              <div
                key={index}
                className="h-24 bg-gray-800 flex items-center justify-center rounded"
              >
                🟫 Empty
              </div>
            );
          }

          const status = getStatus(crop);

          let color = "bg-yellow-700";

          if (status === "Ready")
            color = "bg-green-700";

          return (
            <div
              key={crop.id}
              className={`h-24 ${color} flex flex-col items-center justify-center rounded`}
            >
              🌾
              <div className="text-sm">
                {status}
              </div>
            </div>
          );
        })}

      </div>

    </div>
  );
}