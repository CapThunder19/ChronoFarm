import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWalletUser } from "@/lib/world";
import { normalizeWalletAddress } from "@/lib/wallet";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const walletAddress = typeof body?.walletAddress === "string" ? normalizeWalletAddress(body.walletAddress) : "";

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    const user = await ensureWalletUser(prisma, walletAddress);

    return NextResponse.json({
      message: "Wallet connected",
      walletAddress,
      user: {
        id: user.id,
        name: user.name,
        money: user.money,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to connect wallet" }, { status: 500 });
  }
}
