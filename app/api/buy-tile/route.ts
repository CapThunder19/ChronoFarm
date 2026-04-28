import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const body = await req.json();

    const { tileIndex } = body;

    // Use the farm for the player's current region
    const user = await ensureWalletUser(prisma, walletAddress);
    if (!user)
      return NextResponse.json({
        error: "User not found",
      });

    const currentUser = user;

    const farm = currentUser.currentRegionId
      ? await prisma.farm.findFirst({ where: { userId: currentUser.id, regionId: currentUser.currentRegionId }, include: { tiles: true } })
      : await prisma.farm.findFirst({ where: { userId: currentUser.id }, include: { tiles: true } });

    if (!farm)
      return NextResponse.json({
        error: "Farm not found",
      });

    const tile =
      await prisma.tile.findUnique({
        where: {
          farmId_index: {
            farmId: farm.id,
            index: tileIndex,
          },
        },
      });

    if (!tile)
      return NextResponse.json({
        error: "Tile not found",
      });

    if (tile.unlocked)
      return NextResponse.json({
        message: "Already unlocked",
      });

    // Require farm level for higher tiles. First 3 tiles free/unlockable at start.
    const requiredLevel = Math.max(1, tileIndex - 1);
    if ((farm.level ?? 1) < requiredLevel) {
      return NextResponse.json({ message: `Tile ${tileIndex} requires level ${requiredLevel}` }, { status: 400 });
    }

    const cost = (tileIndex + 1) * 20;

    if (currentUser.money < cost)
      return NextResponse.json({
        message: "Not enough money",
      });

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        money: {
          decrement: cost,
        },
      },
    });

    await prisma.tile.update({
      where: {
        id: tile.id,
      },
      data: {
        unlocked: true,
      },
    });

    return NextResponse.json({
      message: "Tile unlocked",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Buy tile failed" },
      { status: 500 }
    );
  }
}