import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { syncProgressionForFarm } from "@/lib/progression";
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

    if (tileIndex === undefined) {
      return NextResponse.json(
        { error: "Tile index required" },
        { status: 400 }
      );
    }

    const now = new Date();

    // Determine player's farm for current region and find crop on that tile
    const user = await ensureWalletUser(prisma, walletAddress);
    const farm = user?.currentRegionId
      ? await prisma.farm.findFirst({ where: { userId: user.id, regionId: user.currentRegionId } })
      : await prisma.farm.findFirst({ where: { userId: user?.id } });

    // Find crop on that tile for this farm
    const crop = await prisma.crop.findFirst({
      where: {
        tileIndex,
        farmId: farm?.id,
        readyAt: {
          lte: now,
        },
      },
    });

    if (!farm) {
      return NextResponse.json({ error: "Farm not found" }, { status: 404 });
    }

    if (!crop) {
      return NextResponse.json({
        message: "Crop not ready yet",
      });
    }

    // Get reward from crop config
    const cropConfig = CROPS[crop.type];

    if (!cropConfig) {
      return NextResponse.json(
        { error: "Invalid crop type" },
        { status: 400 }
      );
    }

    // Delete crop → tile becomes empty
    await prisma.crop.delete({ where: { id: crop.id } });

    // Check for TRACTOR passive buff
    const tractor = await prisma.inventory.findUnique({
      where: {
        userId_cropType: {
          userId: farm.userId,
          cropType: "TRACTOR"
        }
      }
    });

    const yieldAmount = (tractor && tractor.quantity > 0) ? 2 : 1;

    // Add to inventory
    await prisma.inventory.upsert({
      where: { userId_cropType: { userId: farm.userId, cropType: crop.type } },
      update: { quantity: { increment: yieldAmount } },
      create: { userId: farm.userId, cropType: crop.type, quantity: yieldAmount },
    });

    // Grant XP for harvesting (small amount)
    await prisma.farm.update({ where: { id: farm.id }, data: { xp: { increment: 5 } } });

    // Sync farm level and timeline immediately when XP changes
    await syncProgressionForFarm(prisma, farm.id);

    return NextResponse.json({ message: `Harvested ${yieldAmount} ${cropConfig.name}` });

  } catch (error) {
    console.error("Harvest error:", error);


    return NextResponse.json({ error: "Harvest failed" }, { status: 500 });

  }
}