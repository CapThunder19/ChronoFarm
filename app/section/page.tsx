"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { waitForTransactionReceipt } from "@wagmi/core";
import {
  useAccount,
  useConfig,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { parseEther } from "viem";
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

type InventoryItem = {
  id: string;
  cropType: string;
  quantity: number;
};

import { CROPS } from "@/lib/crops";

const cropOptions = Object.keys(CROPS);

function shortWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SectionPage() {
  const router = useRouter();
  const config = useConfig();
  const { address: connectedAddress, chainId, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { disconnectAsync } = useDisconnect();
  const [walletAddress] = useState(() => getStoredWalletAddress() ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [year, setYear] = useState(1910);
  const [money, setMoney] = useState(0);
  const [chatDraft, setChatDraft] = useState("");
  const [offerForm, setOfferForm] = useState({
    cropType: "WHEAT",
    quantity: "1",
    priceCrypto: "0.01",
    currency: "ETH",
  });
  const [buyingOfferId, setBuyingOfferId] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (!walletAddress) {
      router.push("/");
    }
  }, [walletAddress, router]);

  const loadBoard = useCallback(async () => {
    try {
      const [statusRes, offersRes] = await Promise.all([
        walletFetch("/api/status"),
        walletFetch("/api/trade-offers"),
      ]);

      const [statusData, offerData] = await Promise.all([
        statusRes.json(),
        offersRes.json(),
      ]);

      if (statusRes.ok) {
        setYear(statusData.year ?? 1910);
        setMoney(statusData.money ?? 0);
        setInventory(statusData.inventory ?? []);
      }

      if (offersRes.ok) {
        setOffers(offerData.offers ?? []);
      }
    } catch (error) {
      console.error(error);
      setStatus("Failed to load Section board.");
    }
  }, [walletFetch]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    queueMicrotask(() => {
      loadBoard().finally(() => setIsLoading(false));
    });
    const interval = setInterval(() => {
      void loadBoard();
    }, 10000);

    return () => clearInterval(interval);
  }, [walletAddress, loadBoard]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    const streamUrl = `/api/chat/stream?since=${Date.now() - 60_000}`;
    const source = new EventSource(streamUrl);

    source.addEventListener("messages", (event) => {
      const payload = JSON.parse((event as MessageEvent<string>).data) as { messages?: ChatMessage[] };
      setMessages(payload.messages ?? []);
    });

    source.addEventListener("error", () => {
      setStatus((current) => current || "Chat stream disconnected. Reconnecting...");
    });

    return () => {
      source.close();
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
      await loadBoard();
    } catch (error) {
      console.error(error);
      setStatus("Offer listing failed");
    }
  };

  const buyOffer = async (offer: TradeOffer) => {
    if (offer.walletAddress === walletAddress) {
      setStatus("You cannot buy your own offer.");
      return;
    }

    if (!isConnected || !connectedAddress) {
      setStatus("Connect your wallet to buy offers.");
      return;
    }

    try {
      setBuyingOfferId(offer.id);
      setStatus("Preparing Sepolia transaction...");

      if (chainId !== sepolia.id) {
        await switchChainAsync({ chainId: sepolia.id });
      }

      const txHash = await sendTransactionAsync({
        to: offer.walletAddress as `0x${string}`,
        value: parseEther(offer.priceCrypto),
        chainId: sepolia.id,
      });

      setStatus("Payment sent. Waiting for confirmation...");

      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
        chainId: sepolia.id,
        confirmations: 1,
      });

      if (receipt.status !== "success") {
        setStatus("Payment failed on-chain.");
        return;
      }

      const finalizeRes = await walletFetch(`/api/trade-offers/${offer.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const finalizeData = await finalizeRes.json();

      if (!finalizeRes.ok) {
        setStatus(finalizeData.error || "Payment sent, but offer settlement failed.");
        return;
      }

      setStatus("Offer purchased successfully on Sepolia.");
      await loadBoard();
    } catch (error) {
      console.error(error);
      setStatus("Offer purchase failed.");
    } finally {
      setBuyingOfferId("");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-sm font-mono uppercase tracking-widest">Loading Section...</p>
        </div>
      </div>
    );
  }

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
              <div className="mt-5 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
              <div className="mt-5 space-y-3 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
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
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sepolia</div>
                        <button
                          onClick={() => void buyOffer(offer)}
                          disabled={buyingOfferId === offer.id || offer.walletAddress === walletAddress || offer.status !== "OPEN"}
                          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {offer.walletAddress === walletAddress
                            ? "Your Listing"
                            : buyingOfferId === offer.id
                              ? "Buying..."
                              : "Buy on Sepolia"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl text-sm text-zinc-400">
              Listings settle directly in Sepolia ETH. Buyers pay seller wallet addresses on-chain, then ChronoFarm finalizes crop delivery from the confirmed transaction.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
