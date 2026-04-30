import type { PrismaClient, Region, User } from "@prisma/client";
import { CROPS } from "@/lib/crops";
import { walletUserName } from "@/lib/wallet";

async function createDefaultRegions(prisma: PrismaClient): Promise<Region[]> {
  const europe = await prisma.region.create({
    data: {
      name: "Europe",
      continent: "Europe",
      description: "Industrial heartland of the early 20th century.",
      priceMultiplier: 1.0,
      isActive: true,
      unlockLevel: 1,
    },
  });

  const americas = await prisma.region.create({
    data: {
      name: "Americas",
      continent: "North America",
      description: "The land of opportunity and vast cornfields.",
      priceMultiplier: 1.2,
      isActive: false,
      unlockLevel: 2,
    },
  });

  const asia = await prisma.region.create({
    data: {
      name: "Asia",
      continent: "Asia",
      description: "Ancient lands with growing market potential.",
      priceMultiplier: 0.8,
      isActive: false,
      unlockLevel: 3,
    },
  });

  return [europe, americas, asia];
}

async function ensureTimeline(prisma: PrismaClient) {
  await prisma.timeline.upsert({
    where: { id: 1 },
    update: {},
    create: { year: 1910 },
  });
}

async function ensureRegionalMarket(prisma: PrismaClient, regions: Region[]) {
  for (const region of regions) {
    const npcCount = await prisma.nPC.count({ where: { regionId: region.id } });
    if (npcCount === 0) {
      await prisma.nPC.create({
        data: {
          name: `${region.name} Grain Merchant`,
          regionId: region.id,
        },
      });
      await prisma.nPC.create({
        data: {
          name: `${region.name} Produce Dealer`,
          regionId: region.id,
        },
      });
    }

    for (const cropType of Object.keys(CROPS)) {
      const crop = CROPS[cropType];
      if (crop.regions && !crop.regions.includes(region.name)) {
        continue;
      }

      await prisma.marketPrice.upsert({
        where: {
          cropType_regionId: {
            cropType,
            regionId: region.id,
          },
        },
        create: {
          cropType,
          basePrice: crop.reward * 2,
          price: crop.reward * 2,
          supply: 100,
          demand: 100,
          regionId: region.id,
        },
        update: {},
      });
    }
  }
}

export async function ensureWorldSetup(prisma: PrismaClient): Promise<Region[]> {
  let regions = await prisma.region.findMany({ orderBy: { createdAt: "asc" } });

  if (regions.length === 0) {
    regions = await createDefaultRegions(prisma);
  }

  await ensureTimeline(prisma);
  await ensureRegionalMarket(prisma, regions);

  return regions;
}

export async function ensureWalletUser(prisma: PrismaClient, walletAddress: string): Promise<User> {
  const regions = await ensureWorldSetup(prisma);
  const primaryRegion = regions[0];

  let user = await prisma.user.findFirst({
    where: {
      name: walletUserName(walletAddress),
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: walletUserName(walletAddress),
        money: 100,
        currentRegionId: primaryRegion?.id,
      },
    });
  }

  for (const region of regions) {
    await prisma.farm.upsert({
      where: {
        userId_regionId: {
          userId: user.id,
          regionId: region.id,
        },
      },
      create: {
        userId: user.id,
        regionId: region.id,
        level: 1,
      },
      update: {},
    });
  }

  const farms = await prisma.farm.findMany({ where: { userId: user.id } });
  for (const farm of farms) {
    const existingTiles = await prisma.tile.count({ where: { farmId: farm.id } });
    if (existingTiles > 0) {
      continue;
    }

    const tiles = [];
    for (let i = 0; i < 9; i++) {
      tiles.push({
        farmId: farm.id,
        index: i,
        unlocked: i < 3,
      });
    }
    await prisma.tile.createMany({ data: tiles });
  }

  if (!user.currentRegionId && primaryRegion) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { currentRegionId: primaryRegion.id },
    });
  }

  return user;
}
