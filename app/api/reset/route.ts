import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    console.log("Resetting database...");

    await prisma.$transaction(async (tx) => {
      // DELETE in correct order (relations)
      await tx.crop.deleteMany();
      await tx.tile.deleteMany();
      await tx.inventory.deleteMany();
      await tx.marketListing.deleteMany();
      await tx.farm.deleteMany();
      await tx.user.deleteMany();
      await tx.timeline.deleteMany();

      // CREATE USER
      const user = await tx.user.create({
        data: {
          name: "Player",
          money: 100,
        },
      });

      // CREATE FARM
      const farm = await tx.farm.create({
        data: {
          userId: user.id,
          level: 1,
        },
      });

      // CREATE TILES
      const tiles = [];
      for (let i = 0; i < 9; i++) {
        tiles.push({
          farmId: farm.id,
          index: i,
          unlocked: i < 3,
        });
      }
      await tx.tile.createMany({
        data: tiles,
      });

      // CREATE TIMELINE
      await tx.timeline.create({
        data: {
          year: 1910,
        },
      });
    });

    return NextResponse.json({
      message: "Database reset complete",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Reset failed" },
      { status: 500 }
    );
  }
}