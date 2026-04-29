import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const { cropType, quantity = 1, regionId } = await req.json();

    if (!cropType || !regionId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const user = await ensureWalletUser(prisma, walletAddress);

    // Get current market price
    const marketPrice = await prisma.marketPrice.findUnique({
      where: {
        cropType_regionId: {
          cropType,
          regionId,
        },
      },
    });

    if (!marketPrice) {
      return NextResponse.json({ error: "Item not available in this region" }, { status: 400 });
    }

    const cost = marketPrice.price * quantity;

    if (user.money < cost) {
      return NextResponse.json({ error: "Not enough money" }, { status: 400 });
    }

    // Process transaction
    await prisma.$transaction([
      // Deduct money
      prisma.user.update({
        where: { id: user.id },
        data: { money: { decrement: cost } },
      }),
      // Add to inventory
      prisma.inventory.upsert({
        where: {
          userId_cropType: {
            userId: user.id,
            cropType,
          },
        },
        update: { quantity: { increment: quantity } },
        create: { userId: user.id, cropType, quantity },
      }),
      // Update market supply/demand
      prisma.marketPrice.update({
        where: { id: marketPrice.id },
        data: {
          supply: { decrement: quantity }, // Buying reduces supply
          demand: { increment: quantity }, // Buying increases demand
        },
      }),
    ]);

    return NextResponse.json({ message: `Bought ${quantity} ${CROPS[cropType]?.name || cropType} for $${cost}` });
  } catch (error) {
    console.error("Buy error:", error);
    return NextResponse.json({ error: "Failed to buy item" }, { status: 500 });
  }
}
