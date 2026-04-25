import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { CROPS } from "@/lib/crops";
import { EVENTS } from "@/lib/events";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const {
      cropType,
      quantity,
    } = body;

    const user =
      await prisma.user.findFirst();

    if (!user)
      return NextResponse.json({
        error: "User missing",
      });

    const inventory =
      await prisma.inventory.findUnique({
        where: {
          userId_cropType: {
            userId: user.id,
            cropType,
          },
        },
      });

    if (
      !inventory ||
      inventory.quantity <
        quantity
    )
      return NextResponse.json({
        message:
          "Not enough crops",
      });

    const cropConfig =
      CROPS[cropType];

    const timeline =
      await prisma.timeline.findFirst();

    const event =
      EVENTS[timeline?.year ?? 1910];

    let price =
      cropConfig.reward;

    if (
      event?.effects
        ?.priceMultiplier
    ) {
      price =
        Math.floor(
          price *
            event.effects
              .priceMultiplier
        );
    }

    const totalMoney =
      price * quantity;

    await prisma.inventory.update({
      where: {
        userId_cropType: {
          userId: user.id,
          cropType,
        },
      },
      data: {
        quantity: {
          decrement:
            quantity,
        },
      },
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        money: {
          increment:
            totalMoney,
        },
      },
    });

    return NextResponse.json({
      message: `Sold ${quantity}`,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Sell failed" },
      { status: 500 }
    );
  }
}