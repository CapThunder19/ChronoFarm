import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";

export async function GET() {
  try {
    const existingUser = await prisma.user.findFirst();

    if (existingUser) {
      return NextResponse.json({
        message: "Game already initialized",
      });
    }

    // 1. CREATE REGIONS
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

    const regions = [europe, americas, asia];

    // 2. CREATE USER
    const user = await prisma.user.create({
      data: {
        name: "Player",
        money: 100,
        currentRegionId: europe.id,
      },
    });

    // 3. CREATE A FARM FOR EACH REGION
    const farms: any[] = [];
    for (const region of regions) {
      const f = await prisma.farm.create({
        data: {
          userId: user.id,
          regionId: region.id,
          level: 1,
        },
      });
      farms.push(f);

      // Create tiles for each farm
      const tiles = [];
      for (let i = 0; i < 9; i++) {
        tiles.push({
          farmId: f.id,
          index: i,
          unlocked: i < 3,
        });
      }
      await prisma.tile.createMany({ data: tiles });
    }

    // 5. CREATE TIMELINE
    await prisma.timeline.create({
      data: {
        year: 1910,
      },
    });

    // 6. CREATE NPCs AND MARKET PRICES
    for (const region of regions) {
      // Create multiple NPCs for region
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

      // Create MarketPrices for each crop available in the region
      for (const cropType of Object.keys(CROPS)) {
        const crop = CROPS[cropType];

        // If crop defines regions and this region isn't included, skip
        if (crop.regions && !crop.regions.includes(region.name)) continue;

        const basePrice = crop.reward * 2;
        await prisma.marketPrice.create({
          data: {
            cropType,
            basePrice,
            price: basePrice,
            supply: 100,
            demand: 100,
            regionId: region.id,
          },
        });
      }
    }

    return NextResponse.json({
      message: "Game initialized with 3 regions, NPCs, and dynamic markets",
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Init failed" }, { status: 500 });
  }
}
