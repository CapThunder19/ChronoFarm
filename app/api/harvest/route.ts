import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { syncProgression } from "@/lib/progression";

export async function POST(req: Request) {
  try {
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
    const user = await prisma.user.findFirst();
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

    const reward = cropConfig.reward;

    // Delete crop → tile becomes empty
    await prisma.crop.delete({ where: { id: crop.id } });

    // Find farm associated with this crop (should match player's farm)
    const farmByCrop = await prisma.farm.findUnique({ where: { id: crop.farmId } });
    if (!farmByCrop) {
      return NextResponse.json({ error: "Farm not found" }, { status: 404 });
    }

    // Add to inventory
    await prisma.inventory.upsert({
      where: {
        userId_cropType: {
          userId: farmByCrop.userId,
          cropType: crop.type,
        },
      },
      update: { quantity: { increment: 1 } },
      create: { userId: farmByCrop.userId, cropType: crop.type, quantity: 1 },
    });

    // Grant XP for harvesting (small amount)
    await prisma.farm.update({ where: { id: farmByCrop.id }, data: { xp: { increment: 5 } } });

    // Sync farm level and timeline immediately when XP changes
    await syncProgression(prisma);

    return NextResponse.json({ message: `Harvested 1 ${cropConfig.name}` });

  } catch (error) {
    console.error("Harvest error:", error);


    return NextResponse.json({ error: "Harvest failed" }, { status: 500 });

  }
}