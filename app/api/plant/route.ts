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

    const farm =
      await prisma.farm.findFirst();

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