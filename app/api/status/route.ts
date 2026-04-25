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

    const timeline =
      await prisma.timeline.findFirst();

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

    const farm =
      user.farms[0];

    const event =
      EVENTS[timeline?.year ?? 1910];

    return NextResponse.json({
      money: user.money,
      crops: farm?.crops ?? [],
      tiles: farm?.tiles ?? [],
      inventory: user.inventory ?? [],
      year: timeline?.year ?? 1910,
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