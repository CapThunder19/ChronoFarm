import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { calculatePrice } from "@/lib/pricing";

export async function POST() {
  try {
    const timeline = await prisma.timeline.findFirst();

    if (!timeline) {
      return NextResponse.json({ error: "Timeline missing" }, { status: 404 });
    }

    const eventYears = Object.keys(EVENTS)
      .map((year) => parseInt(year, 10))
      .sort((a, b) => a - b);

    let syncedYear = timeline.year;
    let syncedLevel = 1;

    await prisma.$transaction(async (tx) => {
      // 1. Fetch all regions and prices to update them
      const prices = await tx.marketPrice.findMany({
        include: { region: true }
      });

      // 2. Update all market prices for the current timeline state
      const currentYear = timeline.year;
      const currentEvent = EVENTS[currentYear];

      for (const item of prices) {
        let eventMultiplier = 1.0;
        
        // Regional event check
        if (currentEvent) {
          if (!currentEvent.regions || currentEvent.regions.includes(item.region.name)) {
            eventMultiplier = currentEvent.effects.priceMultiplier ?? 1.0;
          }
        }

        const finalPrice = calculatePrice(
          item.basePrice,
          item.supply,
          item.demand,
          item.region.priceMultiplier,
          eventMultiplier
        );

        await tx.marketPrice.update({
          where: { id: item.id },
          data: { price: finalPrice },
        });
      }

      // Level up farms from XP
      const farms = await tx.farm.findMany();
      let highestLevel = 1;
      for (const f of farms) {
        const xp = f.xp ?? 0;
        const currentLevel = f.level ?? 1;
        // Simple leveling: level = floor(xp / 100) + 1
        const newLevel = Math.floor(xp / 100) + 1;
        if (newLevel > currentLevel) {
          await tx.farm.update({ where: { id: f.id }, data: { level: newLevel } });
        }
        highestLevel = Math.max(highestLevel, newLevel);
      }

      // Map farm level directly to the closest event year:
      // level 1 -> first event year, level 2 -> second, etc.
      const mappedIndex = Math.max(0, Math.min(eventYears.length - 1, highestLevel - 1));
      const mappedYear = eventYears[mappedIndex] ?? currentYear;
      syncedYear = mappedYear;
      syncedLevel = highestLevel;

      // Update timeline to the level-mapped event year
      await tx.timeline.update({
        where: { id: timeline.id },
        data: {
          year: mappedYear,
          lastAdvanced: new Date(),
        },
      });
    });

    return NextResponse.json({
      year: syncedYear,
      level: syncedLevel,
      message: `Timeline synced to level ${syncedLevel}, year ${syncedYear}.`,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to advance time" },
      { status: 500 }
    );
  }
}