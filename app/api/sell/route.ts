import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
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

    if (!cropType || !quantity) {
      return NextResponse.json({
        message: "Invalid request",
      });
    }

    // USER

    const user =
      await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({
        message: "User missing",
      });
    }

    // INVENTORY

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
    ) {
      return NextResponse.json({
        message:
          "Not enough crops",
      });
    }

    // MARKET PRICE

    const market =
      await prisma.marketPrice.findUnique({
        where: {
          cropType,
        },
      });

    if (!market) {
      return NextResponse.json({
        message:
          "Market price missing",
      });
    }

    let price =
      market.price;

    // EVENT EFFECT

    const timeline =
      await prisma.timeline.findFirst();

    const year =
      timeline?.year ?? 1910;

    const event =
      EVENTS[year];

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

    // UPDATE INVENTORY

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

    // UPDATE MONEY

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
      message: `Sold ${quantity} ${cropType} for $${totalMoney}`,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { message: "Sell failed" },
      { status: 500 }
    );
  }
}