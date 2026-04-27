import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const {
      tileIndex,
      type,
    } = body;

    // Find the farm for the player's current region
    const user = await prisma.user.findFirst();
    const farm = user?.currentRegionId
      ? await prisma.farm.findFirst({ where: { userId: user.id, regionId: user.currentRegionId } })
      : await prisma.farm.findFirst({ where: { userId: user?.id } });

    if (!farm)
      return NextResponse.json({
        error: "No farm",
      });

    const existing =
      await prisma.crop.findFirst({
        where: {
          farmId: farm.id,
          tileIndex,
        },
      });

    if (existing)
      return NextResponse.json({
        message:
          "Tile occupied",
      });

    const cropConfig =
      CROPS[type];

    if (!cropConfig)
      return NextResponse.json({
        error: "Invalid crop",
      });

    // Check player's current region and ensure crop is available there
    let currentRegion = null;
    if (user?.currentRegionId) {
      currentRegion = await prisma.region.findUnique({ where: { id: user.currentRegionId } });
    }

    if (cropConfig.regions && currentRegion && !cropConfig.regions.includes(currentRegion.name)) {
      return NextResponse.json({ error: `Cannot plant ${type} in ${currentRegion.name}` });
    }

    // Check farm level against crop unlock level
    const farmWithLevel = await prisma.farm.findUnique({ where: { id: farm.id } });
    const farmLevel = farmWithLevel?.level ?? 1;
    if (cropConfig.unlockLevel && farmLevel < cropConfig.unlockLevel) {
      return NextResponse.json({ error: `Crop ${type} unlocks at level ${cropConfig.unlockLevel}` });
    }

    const timeline =
      await prisma.timeline.findFirst();

    const event =
      EVENTS[timeline?.year ?? 1910];

    let growTime =
      cropConfig.growTime;

    if (
      event?.effects
        ?.growthMultiplier
    ) {
      growTime =
        Math.floor(
          growTime *
            event.effects
              .growthMultiplier
        );
    }

    const now =
      new Date();

    const readyTime =
      new Date(
        now.getTime() +
          growTime
      );

    await prisma.crop.create({
      data: {
        type,
        plantedAt: now,
        readyAt: readyTime,
        tileIndex,
        farmId: farm.id,
      },
    });

    return NextResponse.json({
      message: "Planted",
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Plant failed" },
      { status: 500 }
    );
  }
}