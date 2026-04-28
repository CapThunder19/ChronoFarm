import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { syncProgressionForFarm } from "@/lib/progression";
import { getWalletAddressFromRequest } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function GET(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    const walletUser = await ensureWalletUser(prisma, walletAddress);

    const user = await prisma.user.findFirst({
      where: {
        id: walletUser.id,
      },
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

    const farm = currentRegion ? user?.farms.find((f: any) => f.regionId === currentRegion.id) : user?.farms[0];

    if (!user || !farm) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep the timeline aligned with the active farm only.
    const synced = await syncProgressionForFarm(prisma, farm.id);
    const timeline = await prisma.timeline.findFirst();
    const syncedYear = synced.year;
    const event = EVENTS[syncedYear] ?? null;

    return NextResponse.json({
      money: user.money,
      level: farm?.level ?? 1,
      xp: farm?.xp ?? 0,
      farms: user.farms ?? [],
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      prices,
      year: syncedYear,
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
