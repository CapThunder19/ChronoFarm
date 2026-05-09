require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL!
  .replace("sslmode=require", "")
  .replace("&&", "&")
  .replace("?&", "?");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CROPS = {
  WHEAT: { name: "Wheat", reward: 10 },
  POTATO: { name: "Potato", reward: 20 },
  TOMATO: { name: "Tomato", reward: 30 },
  GRAPE: { name: "Grape", reward: 50 },
};

async function main() {
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
    await prisma.chatMessage.deleteMany();

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
        const basePrice = (CROPS as any)[cropType].reward * 2;
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

    console.log("Reset successful.");
  } catch (err) {
    console.error("Reset failed", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
