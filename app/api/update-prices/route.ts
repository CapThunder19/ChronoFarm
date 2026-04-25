import { prisma } from "@/lib/prisma";
import { EVENTS } from "@/lib/events";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const timeline =
      await prisma.timeline.findFirst();

    const event =
      EVENTS[timeline?.year ?? 1910];

    const multiplier =
      event?.effects?.priceMultiplier ?? 1;

    const prices =
      await prisma.marketPrice.findMany();

    for (const item of prices) {
      const change =
        Math.floor(Math.random() * 6) - 3;

      let basePrice =
        item.price + change;

      if (basePrice < 1)
        basePrice = 1;

      const finalPrice =
        Math.floor(
          basePrice * multiplier
        );

      await prisma.marketPrice.update({
        where: {
          cropType:
            item.cropType,
        },
        data: {
          price: finalPrice,
        },
      });
    }

    return NextResponse.json({
      message: "Prices updated",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed" },
      { status: 500 }
    );
  }
}