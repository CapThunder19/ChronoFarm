import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { tileIndex } = body;

    const farm =
      await prisma.farm.findFirst({
        include: { tiles: true },
      });

    if (!farm)
      return NextResponse.json({
        error: "Farm not found",
      });

    const user =
      await prisma.user.findUnique({
        where: {
          id: farm.userId,
        },
      });

    if (!user)
      return NextResponse.json({
        error: "User not found",
      });

    const tile =
      await prisma.tile.findUnique({
        where: {
          farmId_index: {
            farmId: farm.id,
            index: tileIndex,
          },
        },
      });

    if (!tile)
      return NextResponse.json({
        error: "Tile not found",
      });

    if (tile.unlocked)
      return NextResponse.json({
        message: "Already unlocked",
      });

    const cost =
      (tileIndex + 1) * 20;

    if (user.money < cost)
      return NextResponse.json({
        message: "Not enough money",
      });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        money: {
          decrement: cost,
        },
      },
    });

    await prisma.tile.update({
      where: {
        id: tile.id,
      },
      data: {
        unlocked: true,
      },
    });

    return NextResponse.json({
      message: "Tile unlocked",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Buy tile failed" },
      { status: 500 }
    );
  }
}