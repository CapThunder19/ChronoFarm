import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWalletUser } from "@/lib/world";
import { getWalletAddressFromRequest } from "@/lib/wallet";

const WALLET_PREFIX = "wallet:";

function walletFromUserName(name: string) {
  if (name.startsWith(WALLET_PREFIX)) {
    return name.slice(WALLET_PREFIX.length);
  }

  return name;
}

function displayNameFromWallet(wallet: string) {
  if (!wallet) {
    return "Unknown";
  }

  if (wallet.length <= 12) {
    return wallet;
  }

  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export async function GET(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    await ensureWalletUser(prisma, walletAddress);

    const users = await prisma.user.findMany({
      include: {
        farms: true,
      },
    });

    const leaderboard = users.map((user) => {
      const wallet = walletFromUserName(user.name);
      const levels = user.farms.map((farm) => farm.level ?? 1);
      const xps = user.farms.map((farm) => farm.xp ?? 0);
      const maxLevel = levels.length > 0 ? Math.max(...levels) : 1;
      const totalXp = xps.reduce((sum, xp) => sum + xp, 0);

      return {
        walletAddress: wallet,
        displayName: displayNameFromWallet(wallet),
        money: user.money ?? 0,
        maxLevel,
        totalXp,
        farmCount: user.farms.length,
      };
    });

    leaderboard.sort((a, b) => {
      if (b.money !== a.money) return b.money - a.money;
      if (b.maxLevel !== a.maxLevel) return b.maxLevel - a.maxLevel;
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      return a.walletAddress.localeCompare(b.walletAddress);
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
