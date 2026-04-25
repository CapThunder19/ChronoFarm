import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const existingUser =
      await prisma.user.findFirst({
        include: {
          farms: true,
        },
      });

    if (existingUser) {
      return NextResponse.json({
        message:
          "Game already initialized",
      });
    }

    // Create user

    const user =
      await prisma.user.create({
        data: {
          name: "Player",
          money: 100,
        },
      });

    // Create farm

    const farm =
      await prisma.farm.create({
        data: {
          userId: user.id,
          level: 1,
        },
      });

    // Create tiles

    const tiles = [];

    for (
      let i = 0;
      i < 9;
      i++
    ) {
      tiles.push({
        farmId: farm.id,
        index: i,
        unlocked: i < 3,
      });
    }

    await prisma.tile.createMany({
      data: tiles,
    });

    // Create initial timeline
    await prisma.timeline.create({
      data: {
        year: 1910,
      },
    });

    return NextResponse.json({
      message:
        "Game initialized",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Init failed" },
      { status: 500 }
    );
  }
}