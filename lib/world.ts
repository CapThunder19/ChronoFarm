import type { PrismaClient, Region, User } from "@prisma/client";
import { CROPS } from "@/lib/crops";
import { walletUserName } from "@/lib/wallet";

const WORLD_SETUP_TTL_MS = 5 * 60 * 1000;
let worldSetupCache: { promise: Promise<Region[]>; expiresAt: number } | null = null;

async function createDefaultRegions(prisma: PrismaClient): Promise<Region[]> {
  const europe = await prisma.region.upsert({
    where: { name: "Europe" },
    update: {},
    create: {
      name: "Europe",
      continent: "Europe",
      description: "Industrial heartland of the early 20th century.",
      priceMultiplier: 1.0,
      isActive: true,
      unlockLevel: 1,
    },
  });

  const americas = await prisma.region.upsert({
    where: { name: "Americas" },
    update: {},
    create: {
      name: "Americas",
      continent: "North America",
      description: "The land of opportunity and vast cornfields.",
      priceMultiplier: 1.2,
      isActive: false,
      unlockLevel: 2,
    },
  });

  const asia = await prisma.region.upsert({
    where: { name: "Asia" },
    update: {},
    create: {
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
    const [npcCount, marketCount] = await Promise.all([
      prisma.nPC.count({ where: { regionId: region.id } }),
      prisma.marketPrice.count({ where: { regionId: region.id } }),
    ]);

    if (npcCount === 0) {
      await prisma.nPC.createMany({
        data: [
          {
            name: `${region.name} Grain Merchant`,
            regionId: region.id,
          },
          {
            name: `${region.name} Produce Dealer`,
            regionId: region.id,
          },
        ],
      });
    }

    if (marketCount === 0) {
      const marketData = Object.keys(CROPS)
        .map((cropType) => {
          const crop = CROPS[cropType];
          if (crop.regions && !crop.regions.includes(region.name)) {
            return null;
          }

          return {
            cropType,
            basePrice: crop.reward * 2,
            price: crop.reward * 2,
            supply: 100,
            demand: 100,
            regionId: region.id,
          };
        })
        .filter((entry) => entry !== null) as Array<{
        cropType: string;
        basePrice: number;
        price: number;
        supply: number;
        demand: number;
        regionId: string;
      }>;

      if (marketData.length > 0) {
        await prisma.marketPrice.createMany({
          data: marketData,
          skipDuplicates: true,
        });
      }
    }
  }
}

export async function ensureWorldSetup(prisma: PrismaClient): Promise<Region[]> {
  const now = Date.now();
  if (worldSetupCache && worldSetupCache.expiresAt > now) {
    return worldSetupCache.promise;
  }

  const promise = (async () => {
    // Always upsert canonical regions — idempotent, never creates duplicates
    const canonical = await createDefaultRegions(prisma);

    // Deduplicate: if extra copies exist (from a previous bug), delete them
    const allRegions = await prisma.region.findMany({ orderBy: { createdAt: "asc" } });
    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const r of allRegions) {
      if (seen.has(r.name)) {
        toDelete.push(r.id);
      } else {
        seen.add(r.name);
      }
    }
    if (toDelete.length > 0) {
      // Reassign any users/farms pointing at duplicate regions to canonical ones
      for (const dupId of toDelete) {
        const dupRegion = allRegions.find(r => r.id === dupId)!;
        const canonicalRegion = canonical.find(r => r.name === dupRegion.name)!;
        if (canonicalRegion) {
          await prisma.user.updateMany({
            where: { currentRegionId: dupId },
            data: { currentRegionId: canonicalRegion.id },
          });
          await prisma.farm.updateMany({
            where: { regionId: dupId },
            data: { regionId: canonicalRegion.id },
          });
          await prisma.nPC.deleteMany({ where: { regionId: dupId } });
          await prisma.marketPrice.deleteMany({ where: { regionId: dupId } });
        }
      }
      await prisma.region.deleteMany({ where: { id: { in: toDelete } } });
    }

    const regions = await prisma.region.findMany({ orderBy: { createdAt: "asc" } });

    await ensureTimeline(prisma);
    await ensureRegionalMarket(prisma, regions);

    return regions;
  })();

  worldSetupCache = { promise, expiresAt: now + WORLD_SETUP_TTL_MS };

  try {
    return await promise;
  } catch (error) {
    worldSetupCache = null;
    throw error;
  }
}

export async function ensureWalletUser(prisma: PrismaClient, walletAddress: string): Promise<User> {
  let user = await prisma.user.findFirst({
    where: {
      name: walletUserName(walletAddress),
    },
  });

  if (user) {
    return user;
  }

  const regions = await ensureWorldSetup(prisma);
  const primaryRegion = regions[0];

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: walletUserName(walletAddress),
        money: 100,
        currentRegionId: primaryRegion?.id,
      },
    });
  }

  // Type guard: user is guaranteed to exist now
  const userId = user.id;

  // Parallelize farm upserts for all regions
  await Promise.all(
    regions.map((region) =>
      prisma.farm.upsert({
        where: {
          userId_regionId: {
            userId,
            regionId: region.id,
          },
        },
        create: {
          userId,
          regionId: region.id,
          level: 1,
        },
        update: {},
      })
    )
  );

  const farms = await prisma.farm.findMany({ where: { userId } });

  // Batch create all missing tiles
  const farmsNeedingTiles = await Promise.all(
    farms.map(async (farm) => {
      const count = await prisma.tile.count({ where: { farmId: farm.id } });
      return count === 0 ? farm.id : null;
    })
  );

  const farmIdsNeedingTiles = farmsNeedingTiles.filter((id) => id !== null) as string[];

  if (farmIdsNeedingTiles.length > 0) {
    const tilesToCreate = farmIdsNeedingTiles.flatMap((farmId) =>
      Array.from({ length: 9 }, (_, i) => ({
        farmId,
        index: i,
        unlocked: i < 3,
      }))
    );
    await prisma.tile.createMany({ data: tilesToCreate });
  }

  if (!user.currentRegionId && primaryRegion) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { currentRegionId: primaryRegion.id },
    });
  }

  return user;
}
