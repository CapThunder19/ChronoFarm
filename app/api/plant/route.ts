import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tileIndex } = body;

    const farm = await prisma.farm.findFirst();

    if (!farm) {
      return NextResponse.json({
        error: "No farm found",
      });
    }

    const existing = await prisma.crop.findFirst({
      where: {
        farmId: farm.id,
        tileIndex,
      },
    });

    if (existing) {
      return NextResponse.json({
        message: "Tile already occupied",
      });
    }

    const now = new Date();

    const readyTime = new Date(
      now.getTime() + 10000
    ); // 10 seconds

    await prisma.crop.create({
      data: {
        type: "WHEAT",
        plantedAt: now,
        readyAt: readyTime,
        farmId: farm.id,
        tileIndex,
      },
    });

    return NextResponse.json({
      message: "Planted successfully",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Plant failed" },
      { status: 500 }
    );
  }
}