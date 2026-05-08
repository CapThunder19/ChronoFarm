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
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm font-mono uppercase tracking-widest">Loading Section...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-10 h-full flex flex-col">
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-700 pb-6 lg:flex-row lg:items-end lg:justify-between shrink-0">
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <Link href="/farm" className="hover:text-[var(--foreground)] transition-colors">Farm</Link>
              <span>/</span>
              <Link href="/marketplace" className="hover:text-[var(--foreground)] transition-colors">Marketplace</Link>
              <span>/</span>
              <span className="text-[var(--highlight)]">Section</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter md:text-6xl">GLOBAL SECTION</h1>
            <p className="mt-3 max-w-2xl text-sm text-[var(--text-muted)]">
              Global chat and crypto-denominated crop listings for all connected players.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Wallet</div>
              <div className="font-mono text-sm text-[var(--highlight)]">{walletAddress ? shortWallet(walletAddress) : "Not connected"}</div>
            </div>
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Year</div>
              <div className="font-mono text-sm text-[var(--foreground)]">{year}</div>
            </div>
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Money</div>
              <div className="font-mono text-sm text-yellow-400">${money}</div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-game btn-game-red"
              style={{ padding: "10px 12px", fontSize: "10px" }}
            >
              Logout
            </button>
          </div>
        </header>

        {status && (
          <div className="mb-6 rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.8)] px-4 py-3 text-sm text-[var(--highlight)] shrink-0">
            {status}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-12 h-full overflow-y-auto custom-scrollbar pr-2 lg:overflow-hidden lg:pr-0">
            <section className="space-y-6 lg:col-span-4 lg:h-full lg:overflow-y-auto lg:custom-scrollbar lg:pr-2">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Inventory for Sale</h2>
              <div className="mt-5 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {inventory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--game-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No crops in inventory yet.
                  </div>
                ) : (
                  inventory.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.75)] px-4 py-3">
                      <div className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{item.cropType}</div>
                      <div className="mt-1 text-lg font-mono text-[var(--foreground)]">{item.quantity} units</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Sell for Crypto</h2>
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Crop
                  <select
                    value={offerForm.cropType}
                    onChange={(e) => setOfferForm((current) => ({ ...current, cropType: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                  >
                    {cropOptions.map((crop) => (
                      <option key={crop} value={crop}>{crop}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={offerForm.quantity}
                    onChange={(e) => setOfferForm((current) => ({ ...current, quantity: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                  />
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Crypto Price
                  <input
                    type="text"
                    value={offerForm.priceCrypto}
                    onChange={(e) => setOfferForm((current) => ({ ...current, priceCrypto: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                    placeholder="0.10"
                  />
                </label>

                <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  Currency
                  <select
                    value={offerForm.currency}
                    onChange={(e) => setOfferForm((current) => ({ ...current, currency: e.target.value }))}
                    className="mt-2 w-full rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                  >
                    <option value="ETH">ETH</option>
                  </select>
                </label>

                <button
                  onClick={listOffer}
                  className="btn-game btn-game-green w-full"
                  style={{ padding: "12px 12px", fontSize: "11px" }}
                >
                  List Offer
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-4 lg:h-full lg:overflow-y-auto lg:custom-scrollbar lg:pr-2">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Global Chat</h2>
              <div className="mt-5 h-[420px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.75)] p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                      <span className="font-black text-[var(--highlight)]">{message.displayName}</span>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{message.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <label className="block text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                Send Message
                <textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                  placeholder="Talk to the farm economy..."
                />
              </label>
              <button
                onClick={sendChat}
                className="btn-game btn-game-blue w-full"
                style={{ marginTop: "12px", padding: "10px 12px", fontSize: "10px" }}
              >
                Send Chat
              </button>
            </div>
          </section>

          <section className="space-y-6 lg:col-span-4 lg:h-full lg:overflow-y-auto lg:custom-scrollbar lg:pr-2">
            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl">
              <h2 className="text-xs font-black uppercase tracking-[0.35em] text-[var(--text-muted)]">Open Crypto Listings</h2>
              <div className="mt-5 space-y-3 max-h-[850px] overflow-y-auto pr-2 custom-scrollbar">
                {offers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--game-border)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                    No listings yet.
                  </div>
                ) : (
                  offers.map((offer) => (
                    <div key={offer.id} className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.75)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-[var(--highlight)]">{offer.displayName}</div>
                          <div className="mt-1 text-lg font-bold text-[var(--foreground)]">{offer.quantity} {offer.cropType}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-emerald-300">{offer.priceCrypto} {offer.currency}</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{offer.status}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sepolia</div>
                        <button
                          onClick={() => void buyOffer(offer)}
                          disabled={buyingOfferId === offer.id || offer.walletAddress === walletAddress || offer.status !== "OPEN"}
                          className={`btn-game ${
                            buyingOfferId === offer.id || offer.walletAddress === walletAddress || offer.status !== "OPEN"
                              ? "btn-game-dark"
                              : "btn-game-green"
                          }`}
                          style={{ padding: "8px 10px", fontSize: "9px" }}
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

            <div className="rounded-lg border border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.85)] p-6 shadow-2xl text-sm text-[var(--text-muted)]">
              Listings settle directly in Sepolia ETH. Buyers pay seller wallet addresses on-chain, then ChronoFarm finalizes crop delivery from the confirmed transaction.
            </div>
          </section>
          </div>
        </div>
      </main>
    </div>
  );
}
