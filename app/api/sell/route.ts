import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EVENTS } from "@/lib/events";
import { calculatePrice } from "@/lib/pricing";

export async function POST(req: Request) {
  try {
    const { cropType, quantity, regionId: targetRegionId } = await req.json();

    if (!cropType || !quantity) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ message: "User missing" }, { status: 404 });
    }

    // Determine target region (check body first for global marketplace selling)
    let currentRegion = null;

    if (targetRegionId) {
      currentRegion = await prisma.region.findUnique({
        where: { id: targetRegionId }
      });
    } else {
      const currentRegionId = user.currentRegionId;
      if (currentRegionId) {
        currentRegion = await prisma.region.findUnique({
          where: { id: currentRegionId }
        });
      } else {
        currentRegion = await prisma.region.findFirst({
          where: { isActive: true }
        });
      }
    }

    if (!currentRegion) {
      return NextResponse.json({ message: "Region missing" }, { status: 404 });
    }

    // Inventory check
    const inventory = await prisma.inventory.findUnique({
      where: {
        userId_cropType: {
          userId: user.id,
          cropType,
        },
      },
    });

    if (!inventory || inventory.quantity < quantity) {
      return NextResponse.json({ message: "Not enough crops" }, { status: 400 });
    }

    // Market Price for current region
    const market = await prisma.marketPrice.findUnique({
      where: {
        cropType_regionId: {
          cropType,
          regionId: currentRegion.id,
        },
      },
    });

    if (!market) {
      return NextResponse.json({ message: "Market price missing for this region" }, { status: 404 });
    }

    const totalMoney = market.price * quantity;
    const newSupply = market.supply + quantity;

    // Get event multiplier for price recalculation
    const timeline = await prisma.timeline.findFirst();
    const event = EVENTS[timeline?.year ?? 1910];
    let eventMultiplier = 1.0;
    if (event && (!event.regions || event.regions.includes(currentRegion.name))) {
      eventMultiplier = event.effects.priceMultiplier ?? 1.0;
    }

    const newPrice = calculatePrice(
      market.basePrice,
      newSupply,
      market.demand,
      currentRegion.priceMultiplier,
      eventMultiplier
    );

    // Update Inventory, User Money, and Market in a transaction
    await prisma.$transaction([
      prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: quantity } },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { money: { increment: totalMoney } },
      }),
      prisma.marketPrice.update({
        where: { id: market.id },
        data: { 
          supply: newSupply,
          price: newPrice 
        },
      }),
    ]);

    return NextResponse.json({
      message: `Sold ${quantity} ${cropType} for $${totalMoney}`,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Sell failed" }, { status: 500 });
  }
}