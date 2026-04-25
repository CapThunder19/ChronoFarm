import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";

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

    // Find crop on that tile
    const crop = await prisma.crop.findFirst({
      where: {
        tileIndex,
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
    await prisma.crop.delete({
      where: {
        id: crop.id,
      },
    });

    // Find farm
    const farm = await prisma.farm.findUnique({
      where: {
        id: crop.farmId,
      },
    });

    if (!farm) {
      return NextResponse.json(
        { error: "Farm not found" },
        { status: 404 }
      );
    }

    // Add to inventory
    await prisma.inventory.upsert({
      where: {
        userId_cropType: {
          userId: farm.userId,
          cropType: crop.type,
        },
      },
      update: {
        quantity: {
          increment: 1,
        },
      },
      create: {
        userId: farm.userId,
        cropType: crop.type,
        quantity: 1,
      },
    });

    return NextResponse.json({
      message: `Harvested 1 ${cropConfig.name}`,
    });

  } catch (error) {
    console.error("Harvest error:", error);

    return NextResponse.json(
      { error: "Harvest failed" },
      { status: 500 }
    );
  }
}