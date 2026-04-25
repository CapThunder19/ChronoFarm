import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";

export async function POST() {
  try {
    const timeline =
      await prisma.timeline.findFirst();

    if (!timeline)
      return NextResponse.json({
        error: "Timeline missing",
      });

    const newYear = timeline.year + 1;
    const event = EVENTS[newYear];
    const multiplier = event?.effects?.priceMultiplier ?? 1.0;
    const demandCrops = event?.effects?.demand ?? [];

    await prisma.$transaction(async (tx) => {
      // Update timeline
      await tx.timeline.update({
        where: { id: timeline.id },
        data: {
          year: newYear,
          lastAdvanced: new Date(),
        },
      });

      // Update Market Prices
      const currentPrices = await tx.marketPrice.findMany();
      for (const item of currentPrices) {
        const cropInfo = CROPS[item.cropType];
        if (!cropInfo) continue;

        // Base price with some random drift
        const base = cropInfo.reward;
        const drift = 1 + (Math.random() * 0.4 - 0.2); // +/- 20% random drift
        
        let finalPrice = Math.floor(base * drift * multiplier);

        // Demand bonus
        if (demandCrops.includes(item.cropType)) {
          finalPrice = Math.floor(finalPrice * 1.8);
        }

        if (finalPrice < 1) finalPrice = 1;

        await tx.marketPrice.update({
          where: { cropType: item.cropType },
          data: { price: finalPrice },
        });
      }
    });

    return NextResponse.json({
      year: newYear,
      message: "Year advanced",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to advance time" },
      { status: 500 }
    );
  }
}