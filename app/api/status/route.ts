import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { syncProgression } from "@/lib/progression";

export async function GET() {
  try {
    // Keep the timeline aligned with the current XP/level state.
    await syncProgression(prisma);

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

    // Pick the farm for the current region
    const farm = currentRegion ? user.farms.find((f: any) => f.regionId === currentRegion.id) : user.farms[0];

    return NextResponse.json({
      money: user.money,
      level: farm?.level ?? 1,
      xp: farm?.xp ?? 0,
      farms: user.farms ?? [],
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      prices,
      year,
      lastAdvanced: timeline?.lastAdvanced ?? null,
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
