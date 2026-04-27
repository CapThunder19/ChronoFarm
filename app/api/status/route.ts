import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";

export async function GET() {
  try {
    const user = await prisma.user.findFirst({
      include: {
        inventory: true,
        farms: {
          include: {
            crops: true,
            tiles: true,
          },
        },
      },
    });

    const timeline = await prisma.timeline.findFirst();
    const year = timeline?.year ?? 1910;
    const event = EVENTS[year] ?? null;

    // Determine current region
    const currentRegionId = user?.currentRegionId;
    let currentRegion = null;
    
    if (currentRegionId) {
      currentRegion = await prisma.region.findUnique({
        where: { id: currentRegionId }
      });
    } else {
      // Fallback to any active region or the first one
      currentRegion = await prisma.region.findFirst({
        where: { isActive: true }
      });
    }

    // Fetch prices for current region
    const prices = currentRegion 
      ? await prisma.marketPrice.findMany({
          where: { regionId: currentRegion.id }
        })
      : [];

    const regions = await prisma.region.findMany();

    // Fetch NPC for current region
    const npc = currentRegion
      ? await prisma.nPC.findFirst({
          where: { regionId: currentRegion.id }
        })
      : null;

    if (!user) {
      return NextResponse.json({
        money: 0,
        crops: [],
        tiles: [],
        inventory: [],
        prices: [],
        year,
        event,
        regions,
        currentRegion,
        npc,
      });
    }

    const farm = user.farms[0];

    return NextResponse.json({
      money: user.money,
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      prices,
      year,
      event,
      regions,
      currentRegion,
      npc,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}