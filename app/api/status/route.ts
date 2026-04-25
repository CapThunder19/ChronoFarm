import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";

export async function GET() {
  try {
    const user =
      await prisma.user.findFirst({
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

    let timeline = await prisma.timeline.findFirst();

    if (!user) {
      return NextResponse.json({
        money: 0,
        crops: [],
        tiles: [],
        inventory: [],
        year: 1910,
        event: null,
      });
    }

    const farm = user.farms[0];

    // --- AUTO-ADVANCE TIMELINE ---
    if (timeline) {
      const now = new Date();
      const secondsSinceLastAdvance = (now.getTime() - timeline.lastAdvanced.getTime()) / 1000;
      
      if (secondsSinceLastAdvance >= 60) {
        const yearsToAdvance = Math.floor(secondsSinceLastAdvance / 60);
        const newYear = timeline.year + yearsToAdvance;
        
        // Update DB
        timeline = await prisma.timeline.update({
          where: { id: timeline.id },
          data: {
            year: newYear,
            lastAdvanced: new Date(timeline.lastAdvanced.getTime() + (yearsToAdvance * 60 * 1000)),
          }
        });
      }
    }

    const event =
      EVENTS[timeline?.year ?? 1910];

    return NextResponse.json({
      money: user.money,
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      year: timeline?.year ?? 1910,
      lastAdvanced: timeline?.lastAdvanced ?? new Date(),
      event,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        money: 0,
        crops: [],
        tiles: [],
        inventory: [],
        year: 1910,
        event: null,
      },
      { status: 500 }
    );
  }
}