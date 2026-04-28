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

    const user = await ensureWalletUser(prisma, walletAddress);

    if (!user) {
      return NextResponse.json([]);
    }

    const inventory = await prisma.inventory.findMany({
      where: {
        userId: user.id,
        quantity: {
          gt: 0,
        },
      },
    });

    return NextResponse.json(inventory);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load inventory" },
      { status: 500 }
    );
  }
}
