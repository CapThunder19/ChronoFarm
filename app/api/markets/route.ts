import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function GET(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    await ensureWalletUser(prisma, walletAddress);

    const prices = await prisma.marketPrice.findMany();
    const npcs = await prisma.nPC.findMany();

    return NextResponse.json({
      prices,
      npcs,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
  }
}
