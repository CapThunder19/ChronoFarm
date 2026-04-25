import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { CROPS } from "@/lib/crops";

export async function GET() {
  try {
    // USER + FARM

    const user =
      await prisma.user.findFirst({
        include: {
          inventory: true,
          farms: {
            include: {
              crops: true,
              tiles: true,
            },
          },
        },
      });

    let timeline = await prisma.timeline.findFirst();

    if (!user) {
      return NextResponse.json({
        money: 0,
        crops: [],
        tiles: [],
        inventory: [],
        prices: [],
        year: 1910,
        event: null,
      });
    }

    const farm = user.farms[0];

    // --- AUTO-ADVANCE TIMELINE ---
    if (timeline) {
      const now = new Date();
      const secondsSinceLastAdvance = (now.getTime() - timeline.lastAdvanced.getTime()) / 1000;

      if (secondsSinceLastAdvance >= 60) {
        const yearsToAdvance = Math.floor(secondsSinceLastAdvance / 60);
        const newYear = timeline.year + yearsToAdvance;
        const event = EVENTS[newYear];
        const multiplier = event?.effects?.priceMultiplier ?? 1.0;
        const demandCrops = event?.effects?.demand ?? [];

        // Update DB in transaction
        timeline = await prisma.$transaction(async (tx) => {
          const updatedTimeline = await tx.timeline.update({
            where: { id: timeline!.id },
            data: {
              year: newYear,
              lastAdvanced: new Date(timeline!.lastAdvanced.getTime() + (yearsToAdvance * 60 * 1000)),
            }
          });

          // Update Prices
          const currentPrices = await tx.marketPrice.findMany();
          for (const item of currentPrices) {
            const cropInfo = CROPS[item.cropType];
            if (!cropInfo) continue;
            const drift = 1 + (Math.random() * 0.4 - 0.2);
            let finalPrice = Math.floor(cropInfo.reward * drift * multiplier);
            if (demandCrops.includes(item.cropType)) finalPrice = Math.floor(finalPrice * 1.8);
            if (finalPrice < 1) finalPrice = 1;

            await tx.marketPrice.update({
              where: { cropType: item.cropType },
              data: { price: finalPrice },
            });
          }
          return updatedTimeline;
        });
      }
    }

    const npc = await prisma.nPC.findFirst();
    const marketPrices = await prisma.marketPrice.findMany();
    const event = EVENTS[timeline?.year ?? 1910];

    return NextResponse.json({
      money: user.money,
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      year: timeline?.year ?? 1910,
      lastAdvanced: timeline?.lastAdvanced ?? new Date(),
      event,
      npc,
      marketPrices,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        money: 0,
        crops: [],
        tiles: [],
        inventory: [],
        prices: [],
        year: 1910,
        event: null,
      },
      { status: 500 }
    );
  }
}