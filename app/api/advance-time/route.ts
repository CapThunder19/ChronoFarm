import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { calculatePrice } from "@/lib/pricing";

export async function POST() {
  try {
    const timeline = await prisma.timeline.findFirst();

    if (!timeline) {
      return NextResponse.json({ error: "Timeline missing" }, { status: 404 });
    }

    const newYear = timeline.year + 1;
    const event = EVENTS[newYear];

    await prisma.$transaction(async (tx) => {
      // 1. Update timeline
      await tx.timeline.update({
        where: { id: timeline.id },
        data: {
          year: newYear,
          lastAdvanced: new Date(),
        },
      });

      // 2. Fetch all regions and prices to update them
      const prices = await tx.marketPrice.findMany({
        include: { region: true }
      });

      for (const item of prices) {
        let eventMultiplier = 1.0;
        
        // Regional event check
        if (event) {
          if (!event.regions || event.regions.includes(item.region.name)) {
            eventMultiplier = event.effects.priceMultiplier ?? 1.0;
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
    });

    return NextResponse.json({
      year: newYear,
      message: `Advanced to year ${newYear}. ${event ? `Event: ${event.name}` : ""}`,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to advance time" },
      { status: 500 }
    );
  }
}