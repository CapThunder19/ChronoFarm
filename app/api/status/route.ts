import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { getWalletAddressFromRequest, walletUserName } from "@/lib/wallet";
import { ensureWalletUser } from "@/lib/world";

export async function GET(req: Request) {
  try {
    const walletAddress = getWalletAddressFromRequest(req);
    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 401 });
    }

    let walletUser = await prisma.user.findFirst({
      where: { name: walletUserName(walletAddress) },
    });

    if (!walletUser) {
      walletUser = await ensureWalletUser(prisma, walletAddress);
    }

    const [user, timeline, regions] = await Promise.all([
      prisma.user.findFirst({
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
      }),
      prisma.timeline.findFirst(),
      prisma.region.findMany(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentRegionId = user.currentRegionId;
    const currentRegion = currentRegionId
      ? regions.find((r) => r.id === currentRegionId)
      : regions.find((r) => r.isActive) || regions[0];

    const [prices, npc] = await Promise.all([
      currentRegion
        ? prisma.marketPrice.findMany({
            where: { regionId: currentRegion.id },
          })
        : Promise.resolve([]),
      currentRegion
        ? prisma.nPC.findFirst({
            where: { regionId: currentRegion.id },
          })
        : Promise.resolve(null),
    ]);

    const farm = currentRegion ? user.farms.find((f: any) => f.regionId === currentRegion.id) : user.farms[0];

    if (!farm) {
      return NextResponse.json({ error: "User farm not found" }, { status: 404 });
    }

    // Read year from timeline (no expensive DB write on every poll)
    const year = timeline?.year ?? 1910;
    const event = EVENTS[year] ?? null;

    return NextResponse.json({
      money: user.money,
      level: farm.level ?? 1,
      xp: farm.xp ?? 0,
      farms: user.farms ?? [],
      crops: farm.crops ?? [],
      tiles: farm.tiles ?? [],
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
