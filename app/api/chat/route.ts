import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureWalletUser } from "@/lib/world";
import { getWalletAddressFromRequest, normalizeWalletAddress } from "@/lib/wallet";

function displayNameForWallet(walletAddress: string) {
  const normalized = normalizeWalletAddress(walletAddress);
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export async function GET() {
  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      messages: messages.reverse(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    await ensureWalletUser(prisma, walletAddress);

    const created = await prisma.chatMessage.create({
      data: {
        walletAddress,
        displayName: displayNameForWallet(walletAddress),
        message,
      },
    });

    return NextResponse.json({ message: created });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to send chat message" }, { status: 500 });
  }
}
