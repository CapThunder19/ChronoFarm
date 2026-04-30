import { prisma } from "@/lib/prisma";
import { EVENTS } from "@/lib/events";
import { calculatePrice } from "@/lib/pricing";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const timeline = await prisma.timeline.findFirst();
    const year = timeline?.year ?? 1910;
    const event = EVENTS[year];

    const prices = await prisma.marketPrice.findMany({
      include: { region: true }
    });

    if (prices.length === 0) {
      return NextResponse.json({
        message: "No market prices to update",
      });
    }

    const updates = prices.map((item) => {
      let eventMultiplier = 1.0;

      // Only apply event multiplier if it's global OR if it matches the current item's region
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

      return prisma.marketPrice.update({
        where: { id: item.id },
        data: { price: finalPrice },
      });
    });

    await prisma.$transaction(updates);

    return NextResponse.json({
      message: "Prices updated using regional dynamic supply/demand formula",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update prices" },
      { status: 500 }
    );
  }
}