"use client";

import { useCallback, useEffect, useState, useRef } from "react";
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
import { Send, Plus, Activity, Bell, Globe, Search, ArrowLeft, Sparkles, Loader2, Target, ShieldCheck, Box } from "lucide-react";

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
  const [prices, setPrices] = useState<any[]>([]);
  const [year, setYear] = useState(1910);
  const [money, setMoney] = useState(0);
  const [level, setLevel] = useState(1);
  const [chatDraft, setChatDraft] = useState("");
  const [showListModal, setShowListModal] = useState(false);
  const [offerForm, setOfferForm] = useState({
    cropType: "WHEAT",
    quantity: "1",
    priceCrypto: "0.01",
    currency: "ETH",
  });
  const [buyingOfferId, setBuyingOfferId] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);

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
    if (!walletAddress) router.push("/");
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
        setLevel(statusData.level ?? 1);
        setInventory(statusData.inventory ?? []);
        setPrices(statusData.prices ?? []);
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
    if (!walletAddress) return;
    queueMicrotask(() => {
      loadBoard().finally(() => setIsLoading(false));
    });
    const interval = setInterval(() => void loadBoard(), 10000);
    return () => clearInterval(interval);
  }, [walletAddress, loadBoard]);

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
      
      // Auto-scroll chat
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
    });

    source.addEventListener("error", () => {
      setStatus((current) => current || "Chat stream disconnected. Reconnecting...");
    });

    return () => source.close();
  }, [walletAddress]);

  const handleLogout = async () => {
    try { await disconnectAsync(); } catch (error) { console.error(error); } 
    finally { clearWalletSession(); router.push("/"); }
  };

  const sendChat = async () => {
    const message = chatDraft.trim();
    if (!message) return;

    try {
      setChatDraft("");
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
    } catch (error) {
      setStatus("Chat send failed");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  const listOffer = async () => {
    try {
      setStatus("Listing offer...");
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

      setStatus("Offer listed!");
      setShowListModal(false);
      setOffers((current) => [data.offer, ...current]);
      await loadBoard();
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
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
      setTimeout(() => setStatus(""), 4000);
    } catch (error) {
      setStatus("Offer purchase failed.");
    } finally {
      setBuyingOfferId("");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#050604] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--highlight)] animate-spin" />
      </div>
    );
  }

  // Generate fake activity from recent messages or just static
  const liveActivity = [
    { name: "AlexTheFarmer", action: "Sold 10 Wheat", price: "0.02 ETH", time: "1m ago", emoji: "🌾", color: "border-yellow-500/30", glow: "text-yellow-400" },
    { name: "SarahGreen", action: "Sold 6 Tomato", price: "0.018 ETH", time: "2m ago", emoji: "🍅", color: "border-red-500/30", glow: "text-red-400" },
    { name: "TraderJohn", action: "Bought 20 Corn", price: "0.036 ETH", time: "3m ago", emoji: "🌽", color: "border-green-500/30", glow: "text-green-400" },
    { name: "Mark00", action: "Listed 12 Potato", price: "0.006 ETH", time: "4m ago", emoji: "🥔", color: "border-amber-700/30", glow: "text-amber-500" },
  ];

  return (
    <div className="h-screen w-full bg-[#050604] text-zinc-300 font-sans flex flex-col overflow-hidden selection:bg-[var(--highlight)] selection:text-black">
      
      {/* 1. TOP NAV BAR */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--game-border)] bg-[rgba(var(--panel-bg-rgb),0.5)] shrink-0 z-10">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-serif font-bold tracking-widest text-[var(--highlight)]">
              CHRONO<span className="text-zinc-100">FARM</span>
            </span>
          </div>
          <nav className="hidden lg:flex items-center gap-6 text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">
            <Link href="/farm" className="hover:text-[var(--highlight)] transition-colors">FARM</Link>
            <Link href="/marketplace" className="hover:text-[var(--highlight)] transition-colors">MARKETPLACE</Link>
            <Link href="#" className="text-[var(--highlight)] border-b border-[var(--highlight)] pb-1">GLOBAL EXCHANGE</Link>
            <Link href="/crafting" className="hover:text-[var(--highlight)] transition-colors">ENGINEERING</Link>
          </nav>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-500 font-bold tracking-widest">128 ONLINE</span>
          </div>
          <div className="px-3 py-1.5 border border-[var(--game-border)] bg-[#0d0d0d] rounded flex items-center gap-2 cursor-pointer">
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="text-zinc-200">Europe</span>
          </div>
          <div className="relative cursor-pointer">
            <Bell className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full font-bold">3</span>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-800 cursor-pointer group" onClick={handleLogout}>
            <div className="w-8 h-8 rounded-full border border-[var(--game-border)] bg-[var(--card-bg)] flex items-center justify-center text-lg overflow-hidden group-hover:border-red-400 transition-colors">
              👨‍🌾
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lv. {level}</span>
              <span className="text-sm font-bold text-zinc-200 group-hover:text-red-400 transition-colors">Disconnect</span>
            </div>
          </div>
        </div>
      </header>

      {/* SYSTEM NOTIFICATION */}
      {status && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-2 bg-[var(--panel-bg)] border border-[var(--highlight)] text-[var(--highlight)] text-xs font-bold tracking-widest uppercase rounded shadow-[0_0_15px_rgba(214,168,95,0.2)] animate-pulse flex items-center gap-2">
          <Target className="w-4 h-4" />
          {status}
        </div>
      )}

      {/* MAIN CONTENT GRID */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 bg-[url('/landing-bg.png')] bg-cover bg-center bg-no-repeat relative">
        <div className="absolute inset-0 bg-[#050604]/80 backdrop-blur-sm z-0" />

        {/* --- LEFT PANEL --- */}
        <aside className="w-72 flex flex-col gap-4 z-10 shrink-0">
          {/* Wallet Box */}
          <div className="border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase">WALLET</h2>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Connected</div>
            </div>
            <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.03)] border border-zinc-800/50 p-3 rounded-lg mb-4">
              <div className="text-2xl">💠</div>
              <div>
                <div className="text-sm font-bold text-zinc-200 font-mono tracking-wider">{walletAddress ? shortWallet(walletAddress) : "..."}</div>
                <div className="text-[10px] text-emerald-400 tracking-widest uppercase">Verified</div>
              </div>
            </div>
            <div className="mb-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">BALANCE</div>
              <div className="text-3xl font-serif font-bold text-[var(--highlight)]">${money.toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400 mt-4 border-t border-zinc-800 pt-3">
              NETWORK <div className="w-2 h-2 rounded-full bg-emerald-500 ml-auto" /> <span className="text-emerald-400 font-bold">Sepolia ETH</span>
            </div>
          </div>

          {/* My Inventory */}
          <div className="border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl p-5 shadow-xl flex-1 flex flex-col overflow-hidden">
            <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
              <Box className="w-3.5 h-3.5" /> MY INVENTORY
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
              {inventory.length === 0 ? (
                <div className="text-xs text-zinc-600 italic">No crops available.</div>
              ) : (
                inventory.filter(i => i.quantity > 0).map(item => {
                  const cfg = CROPS[item.cropType];
                  return (
                    <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800/50">
                      <div className="flex items-center gap-2 text-sm">
                        <span>{cfg?.emoji || "📦"}</span>
                        <span className="text-zinc-300 capitalize">{cfg?.name || item.cropType.toLowerCase()}</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-100">{item.quantity}</span>
                    </div>
                  );
                })
              )}
            </div>
            <button className="w-full mt-4 py-2 bg-transparent hover:bg-zinc-900 border border-zinc-700 text-[10px] tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors rounded">
              VIEW ALL INVENTORY
            </button>
          </div>

          {/* Create Listing */}
          <div className="border border-emerald-900/50 bg-[rgba(13,13,13,0.85)] rounded-xl p-5 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
            <button 
              onClick={() => setShowListModal(true)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-widest uppercase rounded flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] mb-3"
            >
              <Plus className="w-4 h-4" /> CREATE LISTING
            </button>
            <p className="text-[10px] text-zinc-400 leading-relaxed text-center">List your crops on the global market and earn from players worldwide.</p>
          </div>

          {/* Market Insights (Graph Mock) */}
          <div className="border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl p-5 shadow-xl h-40 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase">MARKET INSIGHTS</h2>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-300">Wheat Price (Sepolia)</span>
                <span className="text-xs font-bold text-emerald-400">+12.4% <Activity className="inline w-3 h-3" /></span>
              </div>
              <svg className="w-full h-12 overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
                <path d="M0,25 Q10,20 20,22 T40,15 T60,18 T80,5 T100,2" fill="none" stroke="#34d399" strokeWidth="1.5" className="drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                <circle cx="0" cy="25" r="2" fill="#34d399" />
                <circle cx="20" cy="22" r="2" fill="#34d399" />
                <circle cx="40" cy="15" r="2" fill="#34d399" />
                <circle cx="60" cy="18" r="2" fill="#34d399" />
                <circle cx="80" cy="5" r="2" fill="#34d399" />
                <circle cx="100" cy="2" r="2" fill="#34d399" />
              </svg>
              <div className="flex justify-between text-[8px] text-zinc-500 mt-2 tracking-widest">
                <span>May 12</span><span>May 14</span><span>May 16</span><span>May 18</span>
              </div>
            </div>
          </div>
        </aside>

        {/* --- MIDDLE PANEL --- */}
        <div className="flex-1 flex flex-col gap-4 z-10 min-w-0">
          
          {/* Global Chat Box */}
          <div className="flex-1 border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl shadow-xl flex flex-col overflow-hidden min-h-0">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              <div className="px-6 py-4 flex items-center gap-2 border-b-2 border-[var(--highlight)] text-[var(--highlight)] cursor-pointer bg-black/20">
                <Globe className="w-4 h-4" />
                <span className="text-xs font-bold tracking-[0.2em]">GLOBAL CHAT</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                <span className="text-xs font-bold tracking-[0.2em]">TRADE FEED</span>
              </div>
              <div className="ml-auto px-6 py-4 flex items-center gap-2 text-[10px] text-emerald-500 tracking-widest">
                {messages.length} Messages <Activity className="w-3 h-3" />
              </div>
            </div>

            {/* Message List */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {messages.map((msg, i) => {
                const isSystem = msg.displayName === "SYSTEM";
                return (
                  <div key={msg.id || i} className="flex items-start gap-4 p-3 hover:bg-zinc-900/30 rounded-lg transition-colors border-b border-zinc-800/30">
                    <div className={`w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center shrink-0 ${isSystem ? "bg-emerald-900/20 text-emerald-500 border-emerald-800" : "bg-zinc-800 text-lg"}`}>
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
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs italic tracking-widest uppercase">
                  No communications received yet.
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-4 border-t border-zinc-800 bg-[#0a0a0a]">
              <div className="text-[10px] text-zinc-500 tracking-widest mb-2 flex gap-2">
                <span className="animate-pulse">Typing:</span> <span className="text-emerald-500">FarmerJoe, TradeMaster</span>
              </div>
              <div className="flex gap-3 relative">
                <textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
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

          {/* Live Market Activity */}
          <div className="h-32 border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl shadow-xl flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--highlight)]" />
              <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase">LIVE MARKET ACTIVITY</h2>
            </div>
            <div className="flex-1 flex items-center gap-4 px-4 overflow-x-auto custom-scrollbar">
              {liveActivity.map((act, i) => (
                <div key={i} className={`flex items-center gap-4 bg-[#0a0a0a] border ${act.color} rounded-lg p-3 shrink-0 min-w-[200px]`}>
                  <div className="text-3xl filter drop-shadow-md">{act.emoji}</div>
                  <div>
                    <div className={`text-[10px] font-bold tracking-widest ${act.glow}`}>{act.name}</div>
                    <div className="text-xs text-zinc-300">{act.action}</div>
                    <div className="text-sm font-mono font-bold text-zinc-100 mt-1">{act.price}</div>
                    <div className="text-[10px] text-zinc-500">{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <aside className="w-96 flex flex-col z-10 shrink-0 border border-[var(--game-border)] bg-[rgba(13,13,13,0.85)] rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-[var(--highlight)] tracking-[0.2em] uppercase flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> FEATURED LISTINGS
            </h2>
            <span className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300 tracking-widest uppercase">VIEW ALL</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {offers.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs italic tracking-widest py-10">No active listings found.</div>
            ) : (
              offers.map(offer => {
                const cfg = CROPS[offer.cropType];
                const isMine = offer.walletAddress === walletAddress;
                // Determine rarity styling based on cropType or price for aesthetic effect
                const isEpic = offer.cropType === "TRACTOR";
                const isRare = offer.cropType === "FERTILIZER" || offer.cropType === "WOODEN_GEAR";
                const borderCls = isEpic ? "border-purple-500/50" : isRare ? "border-blue-500/50" : "border-zinc-800";
                const tagCls = isEpic ? "bg-purple-900/40 text-purple-400" : isRare ? "bg-blue-900/40 text-blue-400" : "bg-emerald-900/40 text-emerald-400";
                const tagTxt = isEpic ? "EPIC" : isRare ? "RARE" : "COMMON";

                return (
                  <div key={offer.id} className={`bg-[#0a0a0a] border ${borderCls} rounded-lg p-4 flex items-center gap-4 relative overflow-hidden group hover:border-[var(--highlight)] transition-colors`}>
                    {isEpic && <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 blur-xl rounded-full" />}
                    
                    <div className="w-16 h-16 rounded border border-zinc-800 bg-zinc-900 flex items-center justify-center text-4xl shrink-0 shadow-inner">
                      {cfg?.emoji || "📦"}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest mb-1 ${tagCls}`}>{tagTxt}</div>
                          <div className="text-sm font-black text-zinc-100 tracking-wider truncate">{offer.cropType}</div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1">
                            <span className="text-lg">👨‍🌾</span> {offer.displayName}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-zinc-400">x{offer.quantity}</div>
                          <div className="text-[10px] text-zinc-600 mt-2">Just now</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end pl-2 border-l border-zinc-800">
                      <div className="text-sm font-mono font-bold text-emerald-400 mb-1">{offer.priceCrypto} {offer.currency}</div>
                      <div className="text-[10px] text-zinc-500 mb-3 font-mono">~$18.40</div>
                      <button
                        onClick={() => buyOffer(offer)}
                        disabled={buyingOfferId === offer.id || isMine || offer.status !== "OPEN"}
                        className={`w-24 py-1.5 rounded text-[10px] font-bold tracking-widest transition-all ${
                          isMine 
                            ? "bg-zinc-800 text-zinc-500 border border-zinc-700" 
                            : buyingOfferId === offer.id || offer.status !== "OPEN"
                              ? "bg-zinc-800 text-zinc-500"
                              : "bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 border border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        }`}
                      >
                        {isMine ? "OWNED" : buyingOfferId === offer.id ? "BUYING..." : offer.status !== "OPEN" ? offer.status : "BUY NOW"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

      </div>

      {/* 5. BOTTOM RESOURCE TICKER */}
      <div className="h-8 border-t border-[var(--game-border)] bg-[#050604] flex items-center overflow-hidden shrink-0 z-10">
        <div className="flex animate-ticker whitespace-nowrap">
          {prices.length > 0 ? (
            [...prices, ...prices, ...prices].map((price, idx) => {
              const cfg = CROPS[price.cropType];
              // Simulate random up/down for visual effect
              const isUp = idx % 2 === 0;
              return (
                <span key={idx} className="mx-6 text-[10px] tracking-widest flex items-center gap-3">
                  <span className="text-zinc-500">{cfg?.name || price.cropType}</span>
                  <span className="text-zinc-300 font-mono">{price.priceCrypto || "0.005"} ETH</span>
                  <span className={`font-mono font-bold flex items-center ${isUp ? "text-emerald-500" : "text-red-500"}`}>
                    {isUp ? "▲" : "▼"} {((idx + 1) * 2.3).toFixed(1)}%
                  </span>
                  <span className="text-zinc-800 mx-2">|</span>
                </span>
              );
            })
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] tracking-widest px-6">CONNECTING TO GLOBAL MARKET TICKER...</span>
          )}
        </div>
      </div>

      {/* Create Listing Modal Overlay */}
      {showListModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--panel-bg)] border border-[var(--highlight)] rounded-xl w-full max-w-md shadow-[0_0_50px_rgba(214,168,95,0.15)] overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-black/20">
              <h3 className="text-sm font-bold text-[var(--highlight)] tracking-widest uppercase flex items-center gap-2">
                <Box className="w-4 h-4" /> CREATE NEW LISTING
              </h3>
              <button onClick={() => setShowListModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <label className="block">
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Select Crop to List</div>
                <select
                  value={offerForm.cropType}
                  onChange={(e) => setOfferForm((current) => ({ ...current, cropType: e.target.value }))}
                  className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--highlight)] transition-colors"
                >
                  {cropOptions.map((crop) => (
                    <option key={crop} value={crop}>{CROPS[crop]?.emoji} {crop}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Quantity</div>
                  <input
                    type="number"
                    min="1"
                    value={offerForm.quantity}
                    onChange={(e) => setOfferForm((current) => ({ ...current, quantity: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--highlight)] transition-colors font-mono"
                  />
                </label>
                <label className="block">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Price (ETH)</div>
                  <input
                    type="text"
                    value={offerForm.priceCrypto}
                    onChange={(e) => setOfferForm((current) => ({ ...current, priceCrypto: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border border-zinc-700 rounded-lg px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--highlight)] transition-colors font-mono"
                  />
                </label>
              </div>

              <div className="bg-amber-900/20 border border-amber-900/50 p-4 rounded-lg flex gap-3 text-xs text-amber-500/80 leading-relaxed">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                Your listing will be broadcast to the global marketplace. Payments settle securely on the Sepolia network.
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowListModal(false)}
                  className="flex-1 py-3 bg-transparent hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold tracking-widest text-xs rounded transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={listOffer}
                  className="flex-1 py-3 bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border border-emerald-500 text-white font-bold tracking-widest text-xs rounded transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  CONFIRM LISTING
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-ticker {
          animation: ticker 40s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
}
