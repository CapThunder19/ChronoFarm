import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { calculatePrice } from "@/lib/pricing";
import { syncProgressionForFarm } from "@/lib/progression";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function POST(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const user = await ensureWalletUser(prisma, walletAddress);

    const timeline = await prisma.timeline.findFirst();

    if (!timeline) {
      return NextResponse.json({ error: "Timeline missing" }, { status: 404 });
    }

    const activeFarm = user.currentRegionId
      ? await prisma.farm.findFirst({ where: { userId: user.id, regionId: user.currentRegionId } })
      : await prisma.farm.findFirst({ where: { userId: user.id } });

    const synced = await syncProgressionForFarm(prisma, activeFarm?.id ?? "");

    let syncedYear = synced.year;
    let syncedLevel = synced.level;

    await prisma.$transaction(async (tx) => {
      // 1. Fetch all regions and prices to update them
      const prices = await tx.marketPrice.findMany({
        include: { region: true }
      });

      // 2. Update all market prices for the current timeline state
      const currentYear = syncedYear;
      const currentEvent = EVENTS[currentYear];

      for (const item of prices) {
        let eventMultiplier = 1.0;
        
        // Regional event check
        if (currentEvent) {
          if (!currentEvent.regions || currentEvent.regions.includes(item.region.name)) {
            eventMultiplier = currentEvent.effects.priceMultiplier ?? 1.0;
          }
        }

        const finalPrice = calculatePrice(
          item.basePrice,
          item.supply,
          item.demand,
          item.region.priceMultiplier,
          eventMultiplier
        );

        await tx.marketPrice.update({
          where: { id: item.id },
          data: { price: finalPrice },
        });
      }

      // Keep the timeline locked to the farm progression level.
      syncedYear = synced.year;
      syncedLevel = synced.level;

      await tx.timeline.update({
        where: { id: timeline.id },
        data: {
          year: syncedYear,
          lastAdvanced: new Date(),
        },
      });
    });

    return NextResponse.json({
      year: syncedYear,
      level: syncedLevel,
      message: `Timeline synced to level ${syncedLevel}, year ${syncedYear}.`,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to advance time" },
      { status: 500 }
    );
  }
}