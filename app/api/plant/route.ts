import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function POST(
  req: Request
) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const body =
      await req.json();

    const {
      tileIndex,
      type,
    } = body;

    // Find the farm for the player's current region
    const user = await ensureWalletUser(prisma, walletAddress);
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

    if (cropConfig.itemType && cropConfig.itemType !== "crop") {
      return NextResponse.json({
        error: "Cannot plant this item",
      }, { status: 400 });
    }

    // Check player's current region and ensure crop is available there
    let currentRegion = null;
    if (user?.currentRegionId) {
      currentRegion = await prisma.region.findUnique({ where: { id: user.currentRegionId } });
    }

    if (cropConfig.regions && currentRegion && !cropConfig.regions.includes(currentRegion.name)) {
      return NextResponse.json({ error: `Cannot plant ${type} in ${currentRegion.name}` });
    }

    // Check farm level against crop unlock level
    const farmLevel = farm.level ?? 1;
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

    // Check for FERTILIZER passive buff
    const fertilizer = await prisma.inventory.findUnique({
      where: {
        userId_cropType: {
          userId: user.id,
          cropType: "FERTILIZER"
        }
      }
    });

    if (fertilizer && fertilizer.quantity > 0) {
      // 20% growth speed increase
      growTime = Math.floor(growTime * 0.8);
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