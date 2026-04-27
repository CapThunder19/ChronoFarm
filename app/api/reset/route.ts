import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";

export async function POST() {
  try {
    console.log("Resetting world...");

    // DELETE in correct order
    await prisma.crop.deleteMany();
    await prisma.tile.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.marketPrice.deleteMany();
    await prisma.nPC.deleteMany();
    await prisma.farm.deleteMany();
    await prisma.user.deleteMany();
    await prisma.timeline.deleteMany();
    await prisma.region.deleteMany();

    // 1. CREATE REGIONS
    const europe = await prisma.region.create({
      data: {
        name: "Europe",
        continent: "Europe",
        description: "Industrial heartland of the early 20th century.",
        priceMultiplier: 1.0,
        isActive: true,
      },
    });

    const americas = await prisma.region.create({
      data: {
        name: "Americas",
        continent: "North America",
        description: "The land of opportunity and vast cornfields.",
        priceMultiplier: 1.2,
        isActive: false,
      },
    });

    const asia = await prisma.region.create({
      data: {
        name: "Asia",
        continent: "Asia",
        description: "Ancient lands with growing market potential.",
        priceMultiplier: 0.8,
        isActive: false,
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

    // 3. CREATE FARM
    const farm = await prisma.farm.create({
      data: {
        userId: user.id,
      },
    });

    // 4. CREATE TILES
    const tiles = [];
    for (let i = 0; i < 9; i++) {
      tiles.push({
        farmId: farm.id,
        index: i,
        unlocked: i < 3,
      });
    }
    await prisma.tile.createMany({ data: tiles });

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

      // Create MarketPrices for each crop in region
      for (const cropType of Object.keys(CROPS)) {
        const basePrice = CROPS[cropType].reward * 2;
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
      message: "World reset complete with 3 regions, multiple NPCs, and dynamic markets",
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Reset failed" },
      { status: 500 }
    );
  }
}