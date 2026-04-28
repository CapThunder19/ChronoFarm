"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";
import { clearWalletSession, getStoredWalletAddress } from "@/lib/wallet-session";

type ChatMessage = {
  id: string;
  walletAddress: string;
  displayName: string;
  message: string;
  createdAt: string;
};

type TradeOffer = {
  id: string;
  walletAddress: string;
  displayName: string;
  cropType: string;
  quantity: number;
  priceCrypto: string;
  currency: string;
  status: string;
  createdAt: string;
};

const cropOptions = ["WHEAT", "POTATO", "CARROT", "CORN", "TOMATO", "SOYBEAN", "RICE"];

function shortWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SectionPage() {
  const router = useRouter();
  const { disconnectAsync } = useDisconnect();
  const [walletAddress, setWalletAddress] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [year, setYear] = useState(1910);
  const [money, setMoney] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [offerForm, setOfferForm] = useState({
    cropType: "WHEAT",
    quantity: "1",
    priceCrypto: "0.01",
    currency: "ETH",
  });
  const [status, setStatus] = useState("");

  const walletFetch = async (url: string, options?: RequestInit) => {
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
    if (!walletAddress) {
      return;
    }

    const loadBoard = async () => {
      try {
        const [statusRes, chatRes, offersRes] = await Promise.all([
          walletFetch("/api/status"),
          walletFetch("/api/chat"),
          walletFetch("/api/trade-offers"),
        ]);

        const [statusData, chatData, offerData] = await Promise.all([
          statusRes.json(),
          chatRes.json(),
          offersRes.json(),
        ]);

        if (statusRes.ok) {
          setYear(statusData.year ?? 1910);
          setMoney(statusData.money ?? 0);
          setInventory(statusData.inventory ?? []);
        }

        if (chatRes.ok) {
          setMessages(chatData.messages ?? []);
        }

        if (offersRes.ok) {
          setOffers(offerData.offers ?? []);
        }
      } catch (error) {
        console.error(error);
        setStatus("Failed to load Section board.");
      }
    };

    void loadBoard();
    const interval = setInterval(loadBoard, 4000);
    return () => clearInterval(interval);
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

  const sendChat = async () => {
    const message = chatDraft.trim();
    if (!message) return;

    try {
      const res = await walletFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to send message");
        return;
      }

      setChatDraft("");
      setStatus("Message sent");
      const updated = await walletFetch("/api/chat");
      const updatedData = await updated.json();
      setMessages(updatedData.messages ?? []);
    } catch (error) {
      console.error(error);
      setStatus("Chat send failed");
    }
  };

  const listOffer = async () => {
    try {
      const res = await walletFetch("/api/trade-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType: offerForm.cropType,
          quantity: Number(offerForm.quantity),
          priceCrypto: offerForm.priceCrypto,
          currency: offerForm.currency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to list offer");
        return;
      }

      setStatus("Offer listed");
      setOffers((current) => [data.offer, ...current]);
    } catch (error) {
      console.error(error);
      setStatus("Offer listing failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-900 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm text-zinc-500">
              <Link href="/farm" className="hover:text-white transition-colors">Farm</Link>
              <span>/</span>
              <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
              <span>/</span>
              <span className="text-cyan-300">Section</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter md:text-6xl">GLOBAL SECTION</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Global chat and crypto-denominated crop listings for all connected players.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Wallet</div>
              <div className="font-mono text-sm text-cyan-300">{walletAddress ? shortWallet(walletAddress) : "Not connected"}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Year</div>
              <div className="font-mono text-sm text-zinc-200">{year}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">Money</div>
              <div className="font-mono text-sm text-emerald-400">${money}</div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/20"
            >
              Logout
            </button>
          </div>
        </header>

        {status && (
          <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {status}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-4">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-500">Inventory for Sale</h2>
              <div className="mt-5 space-y-3">
                {inventory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                    No crops in inventory yet.
                  </div>
                ) : (
                  inventory.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3">
                      <div className="text-xs font-black uppercase tracking-widest text-zinc-500">{item.cropType}</div>
                      <div className="mt-1 text-lg font-mono text-white">{item.quantity} units</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-500">Sell for Crypto</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                  Crop
                  <select
                    value={offerForm.cropType}
                    onChange={(e) => setOfferForm((current) => ({ ...current, cropType: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none"
                  >
                    {cropOptions.map((crop) => (
                      <option key={crop} value={crop}>{crop}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={offerForm.quantity}
                    onChange={(e) => setOfferForm((current) => ({ ...current, quantity: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none"
                  />
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                  Crypto Price
                  <input
                    type="text"
                    value={offerForm.priceCrypto}
                    onChange={(e) => setOfferForm((current) => ({ ...current, priceCrypto: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none"
                    placeholder="0.10"
                  />
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                  Currency
                  <select
                    value={offerForm.currency}
                    onChange={(e) => setOfferForm((current) => ({ ...current, currency: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none"
                  >
                    <option value="ETH">ETH</option>
                    <option value="USDC">USDC</option>
                    <option value="SOL">SOL</option>
                  </select>
                </label>

                <button
                  onClick={listOffer}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-lime-300 px-4 py-3 text-sm font-black uppercase tracking-widest text-black"
                >
                  List Offer
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-4">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-500">Global Chat</h2>
              <div className="mt-5 h-[420px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span className="font-black text-cyan-300">{message.displayName}</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-200">{message.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
              <label className="block text-xs font-black uppercase tracking-widest text-zinc-500">
                Send Message
                <textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none"
                  placeholder="Talk to the farm economy..."
                />
              </label>
              <button
                onClick={sendChat}
                className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-100"
              >
                Send Chat
              </button>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-4">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-zinc-500">Open Crypto Listings</h2>
              <div className="mt-5 space-y-3">
                {offers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
                    No listings yet.
                  </div>
                ) : (
                  offers.map((offer) => (
                    <div key={offer.id} className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-cyan-300">{offer.displayName}</div>
                          <div className="mt-1 text-lg font-bold text-white">{offer.quantity} {offer.cropType}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-emerald-400">{offer.priceCrypto} {offer.currency}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{offer.status}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl text-sm text-zinc-400">
              Listings are quoted in crypto units. If you want on-chain settlement next, I can wire a chain, token, and escrow flow.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
