import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tileIndex } = body;

    const now = new Date();

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
        message: "Crop not ready",
      });
    }

    await prisma.crop.delete({
      where: {
        id: crop.id,
      },
    });

    const farm = await prisma.farm.findUnique({
      where: {
        id: crop.farmId,
      },
    });

    if (farm) {
      await prisma.user.update({
        where: {
          id: farm.userId,
        },
        data: {
          money: {
            increment: 10,
          },
        },
      });
    }

    return NextResponse.json({
      message: "Harvest successful +10 coins",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Harvest failed" },
      { status: 500 }
    );
  }
}