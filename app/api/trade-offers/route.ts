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
    const offers = await prisma.tradeOffer.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ offers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load offers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const body = await req.json();
    const cropType = typeof body?.cropType === "string" ? body.cropType.trim() : "";
    const quantity = Number(body?.quantity);
    const priceCrypto = typeof body?.priceCrypto === "string" ? body.priceCrypto.trim() : "";
    const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "ETH";

    if (!cropType || !Number.isInteger(quantity) || quantity <= 0 || !priceCrypto) {
      return NextResponse.json({ error: "Crop, quantity, and crypto price are required" }, { status: 400 });
    }

    const user = await ensureWalletUser(prisma, walletAddress);
    const inventory = await prisma.inventory.findUnique({
      where: {
        userId_cropType: {
          userId: user.id,
          cropType,
        },
      },
    });

    if (!inventory || inventory.quantity < quantity) {
      return NextResponse.json({ error: "Not enough inventory to list" }, { status: 400 });
    }

    const offer = await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: quantity } },
      });

      return tx.tradeOffer.create({
        data: {
          walletAddress,
          displayName: displayNameForWallet(walletAddress),
          cropType,
          quantity,
          priceCrypto,
          currency,
        },
      });
    });

    return NextResponse.json({ offer, message: "Offer listed" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}
